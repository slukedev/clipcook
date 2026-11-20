import 'server-only'

import type { InstanceRecord, Store, UpdateLog } from '../db/types'
import { UPSTREAM, type UpdaterConfig } from './config'
import { type CommitInfo, GitHubClient, GitHubError } from './github'
import { fileMap, lastSyncedCommit, planTree, type TreePlan, updateCommitMessage } from './plan'

/** How far back to look for the commit the last update made. */
const HISTORY_DEPTH = 100
const BLOB_CONCURRENCY = 6
/** After pushing, how long Settings shows the host building it. */
const DEPLOY_WINDOW_MS = 20 * 60_000

export type UpdateStatus =
    | { state: 'current'; checkedAt: number }
    | {
          state: 'available'
          checkedAt: number
          upstreamSha: string
          upstreamDate: string
          /** Upstream commits since the last update; null on a first update. */
          commits: number | null
          compareUrl: string
      }
    | { state: 'deploying'; checkedAt: number; upstreamSha: string }
    | { state: 'error'; checkedAt: number; message: string }

interface Snapshot {
    branch: string
    current: CommitInfo
    upstream: CommitInfo
    synced: string | null
}

export function clientFor(config: UpdaterConfig): GitHubClient {
    // Development only: point at a stand-in API to try every state of the Updates section.
    const baseUrl = process.env.NODE_ENV === 'production' ? undefined : process.env.CLIPCOOK_GITHUB_API_URL?.trim()
    return new GitHubClient({ token: config.token, ...(baseUrl ? { baseUrl } : {}) })
}

async function snapshot(client: GitHubClient, config: UpdaterConfig): Promise<Snapshot> {
    const [repo, upstream] = await Promise.all([
        config.branch ? null : client.repo(config.repo),
        client.commit(UPSTREAM.repo, UPSTREAM.branch),
    ])
    const branch = config.branch ?? (repo as { defaultBranch: string }).defaultBranch
    const history = await client.recentCommits(config.repo, branch, HISTORY_DEPTH)
    const current = history[0]
    if (!current) throw new GitHubError('not_found', 404, `${config.repo} has no commits on ${branch}.`)
    return { branch, current, upstream, synced: lastSyncedCommit(history.map((c) => c.message)) }
}

async function planFor(client: GitHubClient, config: UpdaterConfig, snap: Snapshot): Promise<TreePlan> {
    const baseTree = snap.synced
        ? await client
              .commit(UPSTREAM.repo, snap.synced)
              .then((c) => c.treeSha)
              // Upstream history was rewritten: fall back to mirroring it.
              .catch((err: unknown) => {
                  if (err instanceof GitHubError && (err.kind === 'not_found' || err.kind === 'conflict')) return null
                  throw err
              })
        : null
    const [head, current, base] = await Promise.all([
        client.tree(UPSTREAM.repo, snap.upstream.treeSha),
        client.tree(config.repo, snap.current.treeSha),
        baseTree ? client.tree(UPSTREAM.repo, baseTree) : null,
    ])
    return planTree({ base: base && fileMap(base), head: fileMap(head), current: fileMap(current) })
}

const isEmpty = (plan: TreePlan) => plan.writes.length === 0 && plan.deletes.length === 0

/** A push from the last update that the running deployment is not built from yet. */
function pendingDeploy(log: UpdateLog | null, now: number): UpdateLog | null {
    if (log?.outcome !== 'installed' || !log.commitSha || now - log.at > DEPLOY_WINDOW_MS) return null
    const running = process.env.VERCEL_GIT_COMMIT_SHA
    return running === log.commitSha ? null : log
}

export async function checkForUpdate(
    config: UpdaterConfig,
    instance: InstanceRecord,
    { client = clientFor(config), now = Date.now() } = {},
): Promise<UpdateStatus> {
    const deploying = pendingDeploy(instance.lastUpdate, now)
    if (deploying?.upstreamSha) return { state: 'deploying', checkedAt: now, upstreamSha: deploying.upstreamSha }
    try {
        const snap = await snapshot(client, config)
        if (snap.synced === snap.upstream.sha) return { state: 'current', checkedAt: now }
        const [plan, commits] = await Promise.all([
            planFor(client, config, snap),
            snap.synced ? client.aheadBy(UPSTREAM.repo, snap.synced, snap.upstream.sha) : null,
        ])
        if (isEmpty(plan)) return { state: 'current', checkedAt: now }
        return {
            state: 'available',
            checkedAt: now,
            upstreamSha: snap.upstream.sha,
            upstreamDate: snap.upstream.date,
            commits,
            compareUrl: snap.synced
                ? `https://github.com/${UPSTREAM.repo}/compare/${snap.synced.slice(0, 12)}...${snap.upstream.sha.slice(0, 12)}`
                : `https://github.com/${UPSTREAM.repo}/commits/${UPSTREAM.branch}`,
        }
    } catch (err) {
        return { state: 'error', checkedAt: now, message: updateErrorMessage(err, config) }
    }
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
    let next = 0
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const item = items[next++] as T
            await fn(item)
        }
    })
    await Promise.all(workers)
}

export interface InstallResult {
    outcome: 'current' | 'installed'
    upstreamSha: string
    commitSha: string | null
    /** Files edited on this deployment that the update replaced. */
    overwritten: string[]
}

/**
 * Brings upstream into the deployment's branch as one new commit on top of it.
 * Blobs are copied from upstream, the tree is built on the branch's own tree, and
 * the branch only fast-forwards, so a push made meanwhile is never lost.
 */
export async function installUpdate(
    config: UpdaterConfig,
    { client = clientFor(config) }: { client?: GitHubClient } = {},
): Promise<InstallResult> {
    const snap = await snapshot(client, config)
    if (snap.synced === snap.upstream.sha) {
        return { outcome: 'current', upstreamSha: snap.upstream.sha, commitSha: null, overwritten: [] }
    }
    const plan = await planFor(client, config, snap)
    if (isEmpty(plan)) return { outcome: 'current', upstreamSha: snap.upstream.sha, commitSha: null, overwritten: [] }

    await pool(
        plan.writes.filter((w) => w.type === 'blob'),
        BLOB_CONCURRENCY,
        async (write) => {
            const copied = await client.createBlob(config.repo, await client.blob(UPSTREAM.repo, write.sha))
            if (copied !== write.sha) {
                throw new GitHubError('unexpected', 200, `Blob for ${write.path} came back as ${copied}.`)
            }
        },
    )
    const tree = await client.createTree(config.repo, snap.current.treeSha, [
        ...plan.writes.map(({ path, mode, type, sha }) => ({ path, mode, type, sha })),
        ...plan.deletes.map((path) => ({ path, mode: '100644', type: 'blob' as const, sha: null })),
    ])
    const commit = await client.createCommit(
        config.repo,
        updateCommitMessage(snap.upstream.sha),
        tree,
        snap.current.sha,
    )
    await client.fastForward(config.repo, snap.branch, commit)
    return { outcome: 'installed', upstreamSha: snap.upstream.sha, commitSha: commit, overwritten: plan.overwritten }
}

/** One sentence: what went wrong and what to do. */
export function updateErrorMessage(err: unknown, config: Pick<UpdaterConfig, 'repo'>): string {
    if (!(err instanceof GitHubError)) {
        if (process.env.NODE_ENV !== 'test') console.error(err)
        return "The update didn't finish. Try again."
    }
    if (process.env.NODE_ENV !== 'test') console.error(err.message)
    switch (err.kind) {
        case 'unauthorized':
            return 'GitHub rejected CLIPCOOK_UPDATE_TOKEN. Create a new token and replace it.'
        case 'forbidden':
            return `The token can't write to ${config.repo}. Give it read and write access to Contents.`
        case 'not_found':
            return `The token can't see ${config.repo}. Add the repository to the token's access.`
        case 'conflict':
            return 'The repository changed during the update. Try again.'
        case 'rate_limited':
            return 'GitHub is limiting requests. Try again in an hour.'
        case 'network':
            return "Couldn't reach GitHub. Try again."
        default:
            return "The update didn't finish. Try again."
    }
}

export async function recordUpdate(store: Store, log: UpdateLog): Promise<void> {
    await store.updateInstance(() => ({ lastUpdate: log }))
}
