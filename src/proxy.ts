import { NextResponse, type NextRequest } from 'next/server'

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'clipcook_session'
const PUBLIC_PATHS = ['/login']
// The component gallery only exists in dev builds (its page 404s in prod).
if (process.env.NODE_ENV === 'development') PUBLIC_PATHS.push('/dev')

/**
 * Content-Security-Policy, currently REPORT-ONLY: watch the console/reports
 * in production for a while, then flip `CSP_REPORT_ONLY` to false to enforce.
 * The nonce covers Next's inline scripts plus the pre-paint theme script;
 * 'strict-dynamic' lets nonced scripts load Firebase's auth helpers.
 */
const CSP_REPORT_ONLY = true

function buildCsp(nonce: string): string {
    const dev = process.env.NODE_ENV === 'development'
    return [
        `default-src 'self'`,
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://apis.google.com${dev ? " 'unsafe-eval'" : ''}`,
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' data: blob: https://firebasestorage.googleapis.com https://lh3.googleusercontent.com`,
        `font-src 'self'`,
        `connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com`,
        `frame-src https://accounts.google.com https://*.firebaseapp.com`,
        `object-src 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`,
        `frame-ancestors 'none'`,
    ].join('; ')
}

export function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl
    const hasSession = Boolean(req.cookies.get(COOKIE_NAME)?.value)
    const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

    if (!hasSession && !isPublic) {
        const url = req.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('next', pathname)
        return NextResponse.redirect(url)
    }

    const isLogin = pathname === '/login' || pathname.startsWith('/login/')
    if (hasSession && isLogin) {
        const url = req.nextUrl.clone()
        url.pathname = '/'
        url.search = ''
        return NextResponse.redirect(url)
    }

    // Nonce travels on the request so Next tags its inline scripts with it.
    const nonce = btoa(crypto.randomUUID())
    const csp = buildCsp(nonce)
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-nonce', nonce)
    requestHeaders.set('content-security-policy', csp)

    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set(CSP_REPORT_ONLY ? 'content-security-policy-report-only' : 'content-security-policy', csp)
    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-.*\\.png|apple-touch-icon\\.png|logo\\.webp|sw\\.js).*)',
    ],
}
