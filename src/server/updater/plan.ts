import type { TreeEntry } from './github'

/** A file as git stores it: content hash plus mode. Directories are implied by paths. */
export type FileRef = Pick<TreeEntry, 'mode' | 'type' | 'sha'>
export type FileMap = Map<string, FileRef>

export interface TreePlan {
    /** Files to add or replace with upstream's version. */
    writes: TreeEntry[]
    /** Files upstream deleted. */
    deletes: string[]
    /** Files edited on this deployment that upstream also changed; upstream's version wins. */
    overwritten: string[]
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
 * With `base` (the upstream snapshot the last update synced), only files upstream
 * changed since then are touched, so edits made on this deployment to other files
 * survive. Without it (the first update, or history we cannot trace) the result
 * mirrors upstream exactly: a file left over from an older version can break the build.
 */
export function planTree({ base, head, current }: { base: FileMap | null; head: FileMap; current: FileMap }): TreePlan {
    const writes: TreeEntry[] = []
    const deletes: string[] = []
    const overwritten: string[] = []

    if (!base) {
        for (const [path, file] of head) {
            if (!same(current.get(path), file)) writes.push({ path, ...file })
        }
        for (const path of current.keys()) {
            if (!head.has(path)) deletes.push(path)
        }
        return { writes, deletes, overwritten }
    }

    for (const path of new Set([...base.keys(), ...head.keys()])) {
        const before = base.get(path)
        const after = head.get(path)
        if (same(before, after)) continue
        const mine = current.get(path)
        if (same(mine, after)) continue
        if (!same(mine, before)) overwritten.push(path)
        if (after) writes.push({ path, ...after })
        else if (mine) deletes.push(path)
    }
    return { writes, deletes, overwritten }
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

/** `[skip ci]` keeps GitHub Actions from running on the update; the host still deploys it. */
export function updateCommitMessage(upstreamSha: string): string {
    return `Update ClipCook to ${upstreamSha.slice(0, 7)} [skip ci]\n\nUpstream-Commit: ${upstreamSha}\n`
}
