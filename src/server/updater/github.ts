import 'server-only'

/** The slice of the GitHub REST API the updater uses. Every call carries a timeout. */

export type GitHubErrorKind =
    | 'unauthorized'
    | 'forbidden'
    | 'not_found'
    | 'conflict'
    | 'rate_limited'
    | 'network'
    | 'unexpected'

export class GitHubError extends Error {
    readonly kind: GitHubErrorKind
    readonly status: number
    constructor(kind: GitHubErrorKind, status: number, message: string) {
        super(message)
        this.name = 'GitHubError'
        this.kind = kind
        this.status = status
    }
}

export type Fetcher = (input: string, init: RequestInit) => Promise<Response>

export interface GitHubClientOptions {
    token: string
    fetch?: Fetcher
    baseUrl?: string
    timeoutMs?: number
}

export interface TreeEntry {
    path: string
    mode: string
    type: 'blob' | 'tree' | 'commit'
    sha: string
}

export interface CommitInfo {
    sha: string
    treeSha: string
    message: string
    date: string
}

interface RawCommit {
    sha: string
    commit: { message: string; tree: { sha: string }; committer?: { date?: string } | null }
}

const toCommit = (raw: RawCommit): CommitInfo => ({
    sha: raw.sha,
    treeSha: raw.commit.tree.sha,
    message: raw.commit.message,
    date: raw.commit.committer?.date ?? '',
})

/** owner/name, each part restricted to the characters GitHub allows. */
export const REPO_PATTERN = /^[A-Za-z0-9-]{1,39}\/(?!\.\.?$)[A-Za-z0-9._-]{1,100}$/

/** A branch name git accepts, without `.`/`..` segments that would rewrite the API path. */
export function isBranchName(name: string): boolean {
    return (
        /^[A-Za-z0-9._/-]{1,200}$/.test(name) &&
        !name.split('/').some((part) => part === '' || part === '.' || part === '..' || part.endsWith('.lock')) &&
        !name.includes('..')
    )
}

function encodeRef(ref: string): string {
    return ref.split('/').map(encodeURIComponent).join('/')
}

export class GitHubClient {
    private readonly token: string
    private readonly fetcher: Fetcher
    private readonly baseUrl: string
    private readonly timeoutMs: number

    constructor({
        token,
        fetch: fetcher = fetch,
        baseUrl = 'https://api.github.com',
        timeoutMs = 20_000,
    }: GitHubClientOptions) {
        this.token = token
        this.fetcher = fetcher
        this.baseUrl = baseUrl
        this.timeoutMs = timeoutMs
    }

    private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
        let res: Response
        try {
            res = await this.fetcher(`${this.baseUrl}${path}`, {
                method,
                headers: {
                    Accept: 'application/vnd.github+json',
                    Authorization: `Bearer ${this.token}`,
                    'X-GitHub-Api-Version': '2022-11-28',
                    'User-Agent': 'ClipCook-Updater',
                    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
                },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: AbortSignal.timeout(this.timeoutMs),
                cache: 'no-store',
            })
        } catch (err) {
            throw new GitHubError('network', 0, err instanceof Error ? err.message : 'Network error')
        }
        if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T
        const detail = await res.text().catch(() => '')
        throw new GitHubError(
            classify(res, detail),
            res.status,
            `GitHub ${method} ${path}: ${res.status} ${detail.slice(0, 300)}`,
        )
    }

    async repo(repo: string): Promise<{ defaultBranch: string; canPush: boolean }> {
        const data = await this.request<{ default_branch: string; permissions?: { push?: boolean } }>(
            'GET',
            `/repos/${repo}`,
        )
        return { defaultBranch: data.default_branch, canPush: data.permissions?.push === true }
    }

    async commit(repo: string, ref: string): Promise<CommitInfo> {
        return toCommit(await this.request<RawCommit>('GET', `/repos/${repo}/commits/${encodeRef(ref)}`))
    }

    async recentCommits(repo: string, ref: string, count: number, page = 1): Promise<CommitInfo[]> {
        const list = await this.request<RawCommit[]>(
            'GET',
            `/repos/${repo}/commits?sha=${encodeURIComponent(ref)}&per_page=${Math.min(100, count)}&page=${page}`,
        )
        return list.map(toCommit)
    }

    /** Commits on `head` that `base` lacks; null when the two share no history. */
    async aheadBy(repo: string, base: string, head: string): Promise<number | null> {
        try {
            const data = await this.request<{ ahead_by: number }>(
                'GET',
                `/repos/${repo}/compare/${base}...${head}?per_page=1`,
            )
            return data.ahead_by
        } catch (err) {
            if (err instanceof GitHubError && err.kind === 'not_found') return null
            throw err
        }
    }

    /** Every file in a tree, recursively. Throws when GitHub truncates the listing. */
    async tree(repo: string, treeSha: string): Promise<TreeEntry[]> {
        const data = await this.request<{ tree: TreeEntry[]; truncated: boolean }>(
            'GET',
            `/repos/${repo}/git/trees/${treeSha}?recursive=1`,
        )
        if (data.truncated) throw new GitHubError('unexpected', 200, 'The repository tree is too large to list.')
        return data.tree.filter((entry) => entry.type !== 'tree')
    }

    async blob(repo: string, sha: string): Promise<string> {
        const data = await this.request<{ content: string; encoding: string }>('GET', `/repos/${repo}/git/blobs/${sha}`)
        if (data.encoding !== 'base64')
            throw new GitHubError('unexpected', 200, `Unexpected blob encoding ${data.encoding}`)
        return data.content.replace(/\n/g, '')
    }

    async createBlob(repo: string, base64: string): Promise<string> {
        const data = await this.request<{ sha: string }>('POST', `/repos/${repo}/git/blobs`, {
            content: base64,
            encoding: 'base64',
        })
        return data.sha
    }

    async createTree(
        repo: string,
        baseTree: string,
        entries: { path: string; mode: string; type: TreeEntry['type']; sha: string | null }[],
    ): Promise<string> {
        const data = await this.request<{ sha: string }>('POST', `/repos/${repo}/git/trees`, {
            base_tree: baseTree,
            tree: entries,
        })
        return data.sha
    }

    async createCommit(repo: string, message: string, tree: string, parent: string): Promise<string> {
        const data = await this.request<{ sha: string }>('POST', `/repos/${repo}/git/commits`, {
            message,
            tree,
            parents: [parent],
        })
        return data.sha
    }

    /** Fast-forwards a branch; GitHub refuses with 422 if someone pushed in between. */
    async fastForward(repo: string, branch: string, sha: string): Promise<void> {
        await this.request('PATCH', `/repos/${repo}/git/refs/heads/${encodeRef(branch)}`, { sha, force: false })
    }
}

function classify(res: Response, detail: string): GitHubErrorKind {
    if (res.status === 401) return 'unauthorized'
    // Primary limits zero the remaining count; secondary limits send retry-after or say so.
    if (
        res.status === 429 ||
        (res.status === 403 &&
            (res.headers.get('x-ratelimit-remaining') === '0' ||
                res.headers.has('retry-after') ||
                /rate limit/i.test(detail)))
    ) {
        return 'rate_limited'
    }
    if (res.status === 403) return 'forbidden'
    if (res.status === 404) return 'not_found'
    if (res.status === 409 || res.status === 422) return 'conflict'
    return 'unexpected'
}
