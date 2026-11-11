// Client-safe: the sign-in action and the proxy both resolve `next` with it.

const BASE = 'http://clipcook.invalid'

/**
 * The same-origin path a sign-in may continue to, or '/' for anything else.
 * The input is resolved the way a browser would resolve it, so tabs and
 * newlines (which browsers strip, turning '/\t/evil.example' into
 * '//evil.example') and backslashes cannot point it at another host. The
 * length cap is generous because a share-target link carries the whole shared
 * text (/clip?text=).
 */
export function safeNextPath(next: unknown): string {
    if (typeof next !== 'string' || next.length > 8192 || !next.startsWith('/')) return '/'
    let url: URL
    try {
        url = new URL(next, BASE)
    } catch {
        return '/'
    }
    if (url.origin !== BASE) return '/'
    if (url.pathname === '/login' || url.pathname.startsWith('/login/')) return '/'
    return `${url.pathname}${url.search}${url.hash}`
}
