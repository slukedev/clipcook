import type { TreeEntry } from './github'

/** A file as git stores it: content hash plus mode. Directories are implied by paths. */
export type FileRef = Pick<TreeEntry, 'mode' | 'type' | 'sha'>
export type FileMap = Map<string, FileRef>

export interface TreePlan {
    /** Files to add or replace with upstream's version. */
    writes: TreeEntry[]
    /** Files to remove, with the mode and type they have in this deployment. */
    deletes: TreeEntry[]
    /** Files that differ from upstream's last version here, and that this plan replaces or removes. */
    overwritten: string[]
    /** No known base: the plan makes this deployment match upstream exactly. */
    mirror: boolean
}

/**
 * Paths the updater never touches. `.github/` holds the upstream project's CI and
 * repository tooling: a deployment builds on its host, and writing workflow files
 * would also need a token with the Workflows permission.
 */
export function isSyncedPath(path: string): boolean {
    return !path.startsWith('.github/')
}

export function fileMap(entries: TreeEntry[]): FileMap {
    const map: FileMap = new Map()
    for (const entry of entries) {
        if (entry.type !== 'tree' && isSyncedPath(entry.path)) {
            map.set(entry.path, { mode: entry.mode, type: entry.type, sha: entry.sha })
        }
    }
    return map
}

function same(a: FileRef | undefined, b: FileRef | undefined): boolean {
    return a === b || (a !== undefined && b !== undefined && a.sha === b.sha && a.mode === b.mode)
}

/**
 * What to change in this deployment's tree to bring in upstream.
 *
 * With `base` (the upstream version this deployment was last in step with), only
 * files upstream changed since then are touched, so edits made here to other files
 * survive. Without it the result mirrors upstream exactly, replacing local edits and
 * removing local files; callers must not do that without the owner's go-ahead.
 */
export function planTree({ base, head, current }: { base: FileMap | null; head: FileMap; current: FileMap }): TreePlan {
    const writes: TreeEntry[] = []
    const deletes: TreeEntry[] = []
    const overwritten: string[] = []

    if (!base) {
        for (const [path, file] of head) {
            const mine = current.get(path)
            if (same(mine, file)) continue
            writes.push({ path, ...file })
            if (mine) overwritten.push(path)
        }
        for (const [path, mine] of current) {
            if (!head.has(path)) {
                deletes.push({ path, ...mine })
                overwritten.push(path)
            }
        }
        return { writes, deletes, overwritten, mirror: true }
    }

    for (const path of new Set([...base.keys(), ...head.keys()])) {
        const before = base.get(path)
        const after = head.get(path)
        if (same(before, after)) continue
        const mine = current.get(path)
        if (same(mine, after)) continue
        if (!same(mine, before)) overwritten.push(path)
        if (after) writes.push({ path, ...after })
        else if (mine) deletes.push({ path, ...mine })
    }
    return { writes, deletes, overwritten, mirror: false }
}

const TRAILER = /^Upstream-Commit: ([0-9a-f]{40})$/m

/** The upstream commit recorded by the most recent update, if any of these commits carries one. */
export function lastSyncedCommit(messages: string[]): string | null {
    for (const message of messages) {
        const match = TRAILER.exec(message)
        if (match?.[1]) return match[1]
    }
    return null
}

/**
 * `[skip actions]` keeps GitHub Actions from running on the update. It is the
 * GitHub-only spelling: hosts such as Netlify skip builds for `[skip ci]`.
 */
export function updateCommitMessage(upstreamSha: string): string {
    return `Update ClipCook to ${upstreamSha.slice(0, 7)} [skip actions]\n\nUpstream-Commit: ${upstreamSha}\n`
}
