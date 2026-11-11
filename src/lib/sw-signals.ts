// Shared by the service worker (src/sw.ts) and its tests; no DOM or worker globals.

/** Runtime caches that can hold a signed-in cook's pages or photos. */
export const USER_DATA_CACHES = ['pages', 'images', 'next-image'] as const

/**
 * Whether a response ends the session. Signing out from Settings is a server action
 * whose redirect to /login travels in the `x-action-redirect` header ("/login;replace"),
 * with no navigation the worker could see, so the worker reads the header instead.
 */
export function endsSession(headers: Pick<Headers, 'get'>): boolean {
    const target = headers.get('x-action-redirect')?.split(';')[0]?.trim()
    if (!target) return false
    let path: string
    try {
        path = new URL(target, 'http://clipcook.invalid').pathname
    } catch {
        return false
    }
    return path === '/login' || path.startsWith('/login/') || path === '/api/auth/signout'
}
