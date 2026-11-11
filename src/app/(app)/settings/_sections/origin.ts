import 'server-only'

import { headers } from 'next/headers'

/**
 * The public origin the bookmarklet should post to. APP_URL wins; otherwise the
 * host the platform proxy forwarded (the same rule as the API's appOrigin).
 */
export async function requestOrigin(): Promise<string> {
    const configured = process.env.APP_URL?.trim()
    if (configured) {
        try {
            return new URL(configured).origin
        } catch {
            // fall through to the request
        }
    }
    const list = await headers()
    const host = list.get('x-forwarded-host')?.split(',')[0]?.trim() || list.get('host') || 'localhost:3000'
    const forwarded = list.get('x-forwarded-proto')?.split(',')[0]?.trim()
    const local = /^(localhost|127\.|\[::1\])/.test(host)
    const proto = forwarded === 'http' || (!forwarded && local) ? 'http' : 'https'
    return /^[A-Za-z0-9.[\]:-]+$/.test(host) ? `${proto}://${host}` : 'http://localhost:3000'
}
