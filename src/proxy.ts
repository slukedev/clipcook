import { type NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'clipcook_session'

/**
 * Pages that render without a user session. Kitchen displays authenticate with
 * their own cookie, and every /api route checks auth itself (and must answer
 * with a status code, never a login redirect).
 */
const PUBLIC_PREFIXES = ['/login', '/display', '/api', '/offline', '/robots.txt', '/sitemap.xml', '/opengraph-image']
if (process.env.NODE_ENV === 'development') PUBLIC_PREFIXES.push('/dev')

function isPublic(pathname: string): boolean {
    return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Content-Security-Policy, currently REPORT-ONLY: watch the console/reports
 * in production for a while, then flip `CSP_REPORT_ONLY` to false to enforce.
 * The nonce covers Next's inline scripts plus the pre-paint theme script;
 * 'strict-dynamic' lets nonced scripts load Firebase's auth helpers. QR codes
 * are inline SVG markup, so they need no extra allowance.
 */
const CSP_REPORT_ONLY = true

function buildCsp(nonce: string): string {
    const dev = process.env.NODE_ENV === 'development'
    const cast = process.env.NEXT_PUBLIC_CAST_APP_ID ? ' https://www.gstatic.com' : ''
    return [
        `default-src 'self'`,
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://apis.google.com${cast}${dev ? " 'unsafe-eval'" : ''}`,
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' data: blob: https://firebasestorage.googleapis.com https://lh3.googleusercontent.com`,
        `font-src 'self'`,
        `connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com${cast}`,
        `frame-src https://accounts.google.com https://*.firebaseapp.com`,
        `object-src 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`,
        `frame-ancestors 'none'`,
    ].join('; ')
}

export function proxy(req: NextRequest) {
    const { pathname, search } = req.nextUrl
    const hasSession = Boolean(req.cookies.get(COOKIE_NAME)?.value)

    if (!hasSession && !isPublic(pathname)) {
        const url = req.nextUrl.clone()
        url.pathname = '/login'
        // Keep the query too: /clip?url=..., /link?code=... must survive sign-in.
        url.search = ''
        url.searchParams.set('next', `${pathname}${search}`)
        return NextResponse.redirect(url)
    }

    const isLogin = pathname === '/login' || pathname.startsWith('/login/')
    if (hasSession && isLogin) {
        const next = req.nextUrl.searchParams.get('next')
        const url = req.nextUrl.clone()
        url.search = ''
        url.pathname = '/'
        if (next?.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') && !next.startsWith('/login')) {
            const target = new URL(next, req.nextUrl.origin)
            url.pathname = target.pathname
            url.search = target.search
        }
        return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/api/')) return NextResponse.next()

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
        '/((?!_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|icon-.*\\.png|icon\\.svg|apple-touch-icon\\.png|logo\\.webp|sw\\.js).*)',
    ],
}
