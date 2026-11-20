import { createHash } from 'node:crypto'

/**
 * An in-memory GitHub REST API covering what the updater calls. Blob ids are real
 * git blob hashes, so a file copied between repositories keeps its id the way it
 * does on GitHub. Trees are stored flat (path to file), which is all the updater sees
 * through `recursive=1`.
 */

interface File {
    mode: string
    type: 'blob' | 'commit'
    sha: string
}

interface Commit {
    sha: string
    tree: string
    parents: string[]
    message: string
    date: string
}

interface Repo {
    blobs: Map<string, Buffer>
    trees: Map<string, Map<string, File>>
    commits: Map<string, Commit>
    branches: Map<string, string>
    defaultBranch: string
}

export const gitBlobSha = (content: Buffer) =>
    createHash('sha1')
        .update(Buffer.concat([Buffer.from(`blob ${content.length}\0`), content]))
        .digest('hex')

const hashOf = (value: unknown) => createHash('sha1').update(JSON.stringify(value)).digest('hex')

export class FakeGitHub {
    readonly repos = new Map<string, Repo>()
    /** Token to the repositories it may write to. Every token can read every repository. */
    readonly tokens = new Map<string, Set<string>>()
    readonly calls: string[] = []
    /** Runs before each request is handled; lets a test move a branch mid-update. */
    beforeRequest: ((method: string, path: string) => void) | null = null
    private clock = Date.parse('2026-01-01T00:00:00Z')

    createRepo(name: string, defaultBranch = 'main'): void {
        this.repos.set(name, {
            blobs: new Map(),
            trees: new Map(),
            commits: new Map(),
            branches: new Map(),
            defaultBranch,
        })
    }

    private repo(name: string): Repo {
        const repo = this.repos.get(name)
        if (!repo) throw new Error(`no repo ${name}`)
        return repo
    }

    private putBlob(repo: Repo, content: Buffer): string {
        const sha = gitBlobSha(content)
        repo.blobs.set(sha, content)
        return sha
    }

    private putTree(repo: Repo, files: Map<string, File>): string {
        const sha = hashOf([...files].sort(([a], [b]) => a.localeCompare(b)))
        repo.trees.set(sha, files)
        return sha
    }

    private putCommit(repo: Repo, tree: string, parents: string[], message: string): string {
        this.clock += 60_000
        const date = new Date(this.clock).toISOString()
        const sha = hashOf({ tree, parents, message, date })
        repo.commits.set(sha, { sha, tree, parents, message, date })
        return sha
    }

    /** Commits a full snapshot of files (path to text) on top of the branch. */
    commitFiles(name: string, files: Record<string, string>, message = 'Change', branch?: string): string {
        const repo = this.repo(name)
        const ref = branch ?? repo.defaultBranch
        const map = new Map<string, File>()
        for (const [path, text] of Object.entries(files)) {
            map.set(path, { mode: '100644', type: 'blob', sha: this.putBlob(repo, Buffer.from(text)) })
        }
        const parent = repo.branches.get(ref)
        const sha = this.putCommit(repo, this.putTree(repo, map), parent ? [parent] : [], message)
        repo.branches.set(ref, sha)
        return sha
    }

    /** The branch's files as path to text. */
    files(name: string, branch?: string): Record<string, string> {
        const repo = this.repo(name)
        const head = repo.branches.get(branch ?? repo.defaultBranch)
        const commit = head ? repo.commits.get(head) : undefined
        const tree = commit ? repo.trees.get(commit.tree) : undefined
        const out: Record<string, string> = {}
        for (const [path, file] of tree ?? []) out[path] = repo.blobs.get(file.sha)?.toString() ?? ''
        return out
    }

    head(name: string, branch?: string): Commit {
        const repo = this.repo(name)
        const sha = repo.branches.get(branch ?? repo.defaultBranch)
        const commit = sha ? repo.commits.get(sha) : undefined
        if (!commit) throw new Error('no head')
        return commit
    }

    readonly fetch = async (input: string, init: RequestInit): Promise<Response> => {
        const url = new URL(input)
        const method = init.method ?? 'GET'
        this.calls.push(`${method} ${url.pathname}`)
        this.beforeRequest?.(method, url.pathname)
        const auth = new Headers(init.headers).get('authorization')?.replace(/^Bearer /, '') ?? ''
        const writable = this.tokens.get(auth)
        if (!writable) return reply(401, { message: 'Bad credentials' })
        const match = /^\/repos\/([^/]+\/[^/]+)(\/.*)?$/.exec(url.pathname)
        const name = match?.[1] ?? ''
        const rest = match?.[2] ?? ''
        const repo = this.repos.get(name)
        if (!repo) return reply(404, { message: 'Not Found' })
        const body = init.body ? JSON.parse(String(init.body)) : {}
        const canWrite = writable.has(name)
        if (method !== 'GET' && !canWrite)
            return reply(403, { message: 'Resource not accessible by personal access token' })

        if (method === 'GET' && rest === '') {
            return reply(200, { default_branch: repo.defaultBranch, permissions: { push: canWrite } })
        }
        if (method === 'GET' && rest === '/commits') {
            const ref = url.searchParams.get('sha') ?? repo.defaultBranch
            const limit = Number(url.searchParams.get('per_page') ?? 30)
            const skip = (Number(url.searchParams.get('page') ?? 1) - 1) * limit
            const list: Commit[] = []
            let sha = repo.branches.get(ref) ?? ref
            for (let i = 0; i < skip && sha; i++) sha = repo.commits.get(sha)?.parents[0] ?? ''
            while (sha && list.length < limit) {
                const commit = repo.commits.get(sha)
                if (!commit) break
                list.push(commit)
                sha = commit.parents[0] ?? ''
            }
            return reply(200, list.map(rawCommit))
        }
        let m = /^\/commits\/(.+)$/.exec(rest)
        if (method === 'GET' && m) {
            const ref = decodeURIComponent(m[1] ?? '')
            const commit = repo.commits.get(repo.branches.get(ref) ?? ref)
            return commit ? reply(200, rawCommit(commit)) : reply(422, { message: 'No commit found' })
        }
        m = /^\/compare\/([0-9a-f]+)\.\.\.([0-9a-f]+)$/.exec(rest)
        if (method === 'GET' && m) {
            const [base, head] = [m[1] ?? '', m[2] ?? '']
            let ahead = 0
            let sha = [...repo.commits.keys()].find((k) => k.startsWith(head)) ?? ''
            while (sha && !sha.startsWith(base)) {
                ahead++
                sha = repo.commits.get(sha)?.parents[0] ?? ''
            }
            return sha ? reply(200, { ahead_by: ahead }) : reply(404, { message: 'Not Found' })
        }
        m = /^\/git\/trees\/([0-9a-f]+)$/.exec(rest)
        if (method === 'GET' && m) {
            const tree = repo.trees.get(m[1] ?? '')
            if (!tree) return reply(404, { message: 'Not Found' })
            return reply(200, { truncated: false, tree: [...tree].map(([path, f]) => ({ path, ...f })) })
        }
        m = /^\/git\/blobs\/([0-9a-f]+)$/.exec(rest)
        if (method === 'GET' && m) {
            const blob = repo.blobs.get(m[1] ?? '')
            if (!blob) return reply(404, { message: 'Not Found' })
            // GitHub wraps base64 at 60 characters.
            const wrapped = blob.toString('base64').replace(/(.{60})/g, '$1\n')
            return reply(200, { content: wrapped, encoding: 'base64' })
        }
        if (method === 'POST' && rest === '/git/blobs') {
            return reply(201, { sha: this.putBlob(repo, Buffer.from(body.content, 'base64')) })
        }
        if (method === 'POST' && rest === '/git/trees') {
            const base = repo.trees.get(body.base_tree)
            if (!base) return reply(422, { message: 'base_tree not found' })
            const next = new Map(base)
            for (const entry of body.tree as { path: string; mode: string; type: File['type']; sha: string | null }[]) {
                if (entry.sha === null) next.delete(entry.path)
                else if (entry.type === 'blob' && !repo.blobs.has(entry.sha))
                    return reply(422, { message: 'missing blob' })
                else next.set(entry.path, { mode: entry.mode, type: entry.type, sha: entry.sha })
            }
            return reply(201, { sha: this.putTree(repo, next) })
        }
        if (method === 'POST' && rest === '/git/commits') {
            if (!repo.trees.has(body.tree)) return reply(422, { message: 'tree not found' })
            return reply(201, { sha: this.putCommit(repo, body.tree, body.parents, body.message) })
        }
        m = /^\/git\/refs\/heads\/(.+)$/.exec(rest)
        if (method === 'PATCH' && m) {
            const branch = decodeURIComponent(m[1] ?? '')
            const current = repo.branches.get(branch)
            let sha: string = body.sha
            let fastForward = false
            while (sha) {
                if (sha === current) {
                    fastForward = true
                    break
                }
                sha = repo.commits.get(sha)?.parents[0] ?? ''
            }
            if (!fastForward && !body.force) return reply(422, { message: 'Update is not a fast forward' })
            repo.branches.set(branch, body.sha)
            return reply(200, { ref: `refs/heads/${branch}` })
        }
        return reply(404, { message: `Unhandled ${method} ${rest}` })
    }
}

function rawCommit(c: Commit) {
    return { sha: c.sha, commit: { message: c.message, tree: { sha: c.tree }, committer: { date: c.date } } }
}

function reply(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
