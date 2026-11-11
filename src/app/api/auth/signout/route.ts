import { type NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'clipcook_session'

/**
 * Clears the session cookie and sends the user to /login.
 *
 * Deliberately admin-free: it never touches firebase-admin, so it can't hit the
 * same module-load failure that a stale/legacy session cookie triggers during
 * verification. That makes it a safe recovery target when the authed layout
 * can't establish a session: the browser drops the cookie and the next request
 * looks just like an incognito one, which renders fine.
 */
export function GET(req: NextRequest) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    const res = NextResponse.redirect(url)
    // Match the attributes createSession() set the cookie with so the browser
    // actually removes it.
    res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
    return res
}
