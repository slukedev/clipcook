import { REPO_PATTERN } from './github'

/** The repository every deployment updates from. */
export const UPSTREAM = { repo: 'slukedev/clipcook', branch: 'main' } as const

export interface UpdaterConfig {
    token: string
    /** owner/name of the repository this deployment builds from. */
    repo: string
    /** null: the repository's default branch. */
    branch: string | null
}

export type UpdaterSetup =
    /** The upstream project itself, or a plain local checkout: nothing to update from. */
    | { kind: 'hidden' }
    | { kind: 'missing'; missing: ('token' | 'repo')[]; repo: string | null }
    | { kind: 'ready'; config: UpdaterConfig }

type Env = Record<string, string | undefined>

function deploymentRepo(env: Env): string | null {
    const explicit = env.CLIPCOOK_UPDATE_REPO?.trim()
    if (explicit) return REPO_PATTERN.test(explicit) ? explicit : null
    // Vercel exposes the Git source of every deployment at runtime.
    const owner = env.VERCEL_GIT_REPO_OWNER?.trim()
    const slug = env.VERCEL_GIT_REPO_SLUG?.trim()
    if (env.VERCEL_GIT_PROVIDER === 'github' && owner && slug && REPO_PATTERN.test(`${owner}/${slug}`)) {
        return `${owner}/${slug}`
    }
    return null
}

export function resolveUpdaterSetup(env: Env = process.env, backend: 'firebase' | 'local'): UpdaterSetup {
    const repo = deploymentRepo(env)
    const token = env.CLIPCOOK_UPDATE_TOKEN?.trim() || null
    if (repo && repo.toLowerCase() === UPSTREAM.repo) return { kind: 'hidden' }
    // A local checkout with nothing set is development, not a deployment.
    if (!repo && !token && backend === 'local') return { kind: 'hidden' }
    const missing: ('token' | 'repo')[] = []
    if (!token) missing.push('token')
    if (!repo) missing.push('repo')
    if (!token || !repo) return { kind: 'missing', missing, repo }
    const branch = env.CLIPCOOK_UPDATE_BRANCH?.trim() || null
    return { kind: 'ready', config: { token, repo, branch } }
}

/**
 * A fine-grained token form with the name and permission filled in. GitHub only
 * offers repositories the chosen owner has, so the owner is prefilled too.
 */
export function tokenFormUrl(repo: string | null): string {
    const params = new URLSearchParams({
        name: 'ClipCook updates',
        description: 'Lets ClipCook install updates from slukedev/clipcook.',
        expires_in: 'none',
        contents: 'write',
    })
    const owner = repo?.split('/')[0]
    if (owner) params.set('target_name', owner)
    return `https://github.com/settings/personal-access-tokens/new?${params}`
}
