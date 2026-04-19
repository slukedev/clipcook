import { NextResponse, type NextRequest } from 'next/server'

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'clipcook_session'
const PUBLIC_PATHS = ['/login']

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

    if (hasSession && isPublic) {
        const url = req.nextUrl.clone()
        url.pathname = '/'
        url.search = ''
        return NextResponse.redirect(url)
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-.*\\.png|apple-touch-icon\\.png|logo\\.webp|sw\\.js|swe-worker-.*\\.js|workbox-.*\\.js).*)'],
}
