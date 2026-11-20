import 'server-only'

import type { InstanceRecord, Store, UpdateLog } from '../db/types'
import { UPSTREAM, type UpdaterConfig } from './config'
import { type CommitInfo, GitHubClient, GitHubError } from './github'
import { fileMap, lastSyncedCommit, planTree, type TreePlan, updateCommitMessage } from './plan'

/** How far back to look for the commit the last update made. */
const HISTORY_DEPTH = 100
/** Upstream pages searched for the version a deployment without update commits started from. */
const UPSTREAM_SEARCH_PAGES = 5
// GitHub caps content creation at about 80 requests a minute; stay well under it.
const BLOB_CONCURRENCY = 4
/** After pushing, how long Settings shows the host building it. */
export const DEPLOY_WINDOW_MS = 20 * 60_000
/** Paths kept in the log of what an update replaced. */
const LOGGED_PATHS = 50

export type UpdateStatus =
    | { state: 'current'; checkedAt: number }
    | {
          state: 'available'
          checkedAt: number
          upstreamSha: string
          upstreamDate: string
          /** Upstream commits since the last update; null when unknown. */
          commits: number | null
          compareUrl: string
          /**
           * Files here that differ from upstream's last version and would be replaced or
           * removed. With `review`, the update needs the owner to press Update.
           */
          replaces: number
          review: boolean
      }
    | { state: 'deploying'; checkedAt: number; upstreamSha: string }
    | { state: 'error'; checkedAt: number; message: string }

interface Snapshot {
    branch: string
    current: CommitInfo
    upstream: CommitInfo
    /** The upstream commit this deployment was last in step with, when it can be told. */
    base: string | null
    /** Whether `base` comes from an update commit's trailer (rather than a matching tree). */
    synced: boolean
}

export function clientFor(config: UpdaterConfig): GitHubClient {
    // Development only: point at a stand-in API to try every state of the Updates section.
    const baseUrl = process.env.NODE_ENV === 'production' ? undefined : process.env.CLIPCOOK_GITHUB_API_URL?.trim()
    return new GitHubClient({ token: config.token, ...(baseUrl ? { baseUrl } : {}) })
}

/**
 * The newest upstream commit whose files this deployment once matched exactly.
 * A deploy-button clone starts as a copy of some upstream commit with fresh
 * history, so its first commit's tree is one of upstream's.
 */
async function matchingUpstream(client: GitHubClient, history: CommitInfo[]): Promise<string | null> {
    const trees = new Set(history.map((c) => c.treeSha))
    for (let page = 1; page <= UPSTREAM_SEARCH_PAGES; page++) {
        const commits = await client.recentCommits(UPSTREAM.repo, UPSTREAM.branch, 100, page)
        const match = commits.find((c) => trees.has(c.treeSha))
        if (match) return match.sha
        if (commits.length < 100) break
    }
    return null
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
    const synced = lastSyncedCommit(history.map((c) => c.message))
    if (synced) return { branch, current, upstream, base: synced, synced: true }
    return { branch, current, upstream, base: await matchingUpstream(client, history), synced: false }
}

interface Planned {
    plan: TreePlan
    /** Blob ids this deployment already has, so they need no copying. */
    present: Set<string>
}

async function planFor(client: GitHubClient, config: UpdaterConfig, snap: Snapshot): Promise<Planned> {
    const baseTree = snap.base
        ? await client
              .commit(UPSTREAM.repo, snap.base)
              .then((c) => c.treeSha)
              // Upstream history was rewritten; the plan falls back to a reviewed mirror.
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
    const plan = planTree({ base: base && fileMap(base), head: fileMap(head), current: fileMap(current) })
    return { plan, present: new Set(current.map((entry) => entry.sha)) }
}

const isEmpty = (plan: TreePlan) => plan.writes.length === 0 && plan.deletes.length === 0
/** An update that would replace or remove anything changed here waits for the owner. */
const needsReview = (plan: TreePlan) => plan.overwritten.length > 0

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
        if (snap.synced && snap.base === snap.upstream.sha) return { state: 'current', checkedAt: now }
        const [{ plan }, commits] = await Promise.all([
            planFor(client, config, snap),
            snap.base ? client.aheadBy(UPSTREAM.repo, snap.base, snap.upstream.sha) : null,
        ])
        if (isEmpty(plan)) return { state: 'current', checkedAt: now }
        return {
            state: 'available',
            checkedAt: now,
            upstreamSha: snap.upstream.sha,
            upstreamDate: snap.upstream.date,
            commits,
            compareUrl: snap.base
                ? `https://github.com/${UPSTREAM.repo}/compare/${snap.base.slice(0, 12)}...${snap.upstream.sha.slice(0, 12)}`
                : `https://github.com/${UPSTREAM.repo}/commits/${UPSTREAM.branch}`,
            replaces: plan.overwritten.length,
            review: needsReview(plan),
        }
    } catch (err) {
        return { state: 'error', checkedAt: now, message: updateErrorMessage(err, config) }
    }
}

/** Runs `fn` over `items` with at most `limit` in flight; the first failure stops new work. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
    let next = 0
    let failed = false
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (!failed && next < items.length) {
            const item = items[next++] as T
            try {
                await fn(item)
            } catch (err) {
                failed = true
                throw err
            }
        }
    })
    await Promise.all(workers)
}

export class ReviewRequiredError extends Error {
    readonly replaces: number
    constructor(replaces: number) {
        super('REVIEW_REQUIRED')
        this.name = 'ReviewRequiredError'
        this.replaces = replaces
    }
}

export interface InstallResult {
    outcome: 'current' | 'installed'
    upstreamSha: string
    commitSha: string | null
    /** Files that differed here and that the update replaced or removed. */
    overwritten: string[]
}

/**
 * Brings upstream into the deployment's branch as one new commit on top of it.
 * Blobs are copied from upstream, the tree is built on the branch's own tree, and
 * the branch only fast-forwards, so a push made meanwhile is never lost. An update
 * that would replace work done here throws ReviewRequiredError unless `reviewed`.
 */
export async function installUpdate(
    config: UpdaterConfig,
    { client = clientFor(config), reviewed = false }: { client?: GitHubClient; reviewed?: boolean } = {},
): Promise<InstallResult> {
    const snap = await snapshot(client, config)
    const none = { outcome: 'current' as const, upstreamSha: snap.upstream.sha, commitSha: null, overwritten: [] }
    if (snap.synced && snap.base === snap.upstream.sha) return none
    const { plan, present } = await planFor(client, config, snap)
    if (isEmpty(plan)) return none
    if (needsReview(plan) && !reviewed) throw new ReviewRequiredError(plan.overwritten.length)

    await pool(
        plan.writes.filter((w) => w.type === 'blob' && !present.has(w.sha)),
        BLOB_CONCURRENCY,
        async (write) => {
            const copied = await client.createBlob(config.repo, await client.blob(UPSTREAM.repo, write.sha))
            if (copied !== write.sha) {
                throw new GitHubError('unexpected', 200, `Blob for ${write.path} came back as ${copied}.`)
            }
        },
    )
    // Deletes first, writes on top: a file that became a folder (or the other way
    // round) would otherwise collide inside one tree request.
    let tree = snap.current.treeSha
    if (plan.deletes.length > 0) {
        tree = await client.createTree(
            config.repo,
            tree,
            plan.deletes.map(({ path, mode, type }) => ({ path, mode, type, sha: null })),
        )
    }
    if (plan.writes.length > 0) {
        tree = await client.createTree(
            config.repo,
            tree,
            plan.writes.map(({ path, mode, type, sha }) => ({ path, mode, type, sha })),
        )
    }
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
    if (err instanceof ReviewRequiredError) return 'This update replaces files changed here. Install it from Settings.'
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

/**
 * Saves what a run did. A run that found nothing to do, or lost a race with
 * another run, never hides an install that is still deploying.
 */
export async function recordUpdate(store: Store, log: UpdateLog): Promise<void> {
    await store.updateInstance((current) => {
        const previous = current.lastUpdate
        const deploying = previous?.outcome === 'installed' && log.at - previous.at < DEPLOY_WINDOW_MS
        if (deploying && log.outcome !== 'installed') return null
        return { lastUpdate: { ...log, overwritten: log.overwritten.slice(0, LOGGED_PATHS) } }
    })
}
