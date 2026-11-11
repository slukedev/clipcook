import type { NextRequest } from 'next/server'
import { bookmarkletHref, bookmarkletSource } from '@/lib/domain/bookmarklet'
import { appOrigin } from '@/server/http'

/** The bookmarklet as JavaScript, or with ?format=href as the draggable javascript: URL. */
export function GET(req: NextRequest) {
    const origin = appOrigin(req)
    const href = req.nextUrl.searchParams.get('format') === 'href'
    return new Response(href ? bookmarkletHref(origin) : bookmarkletSource(origin), {
        headers: {
            'Content-Type': href ? 'text/plain; charset=utf-8' : 'text/javascript; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
        },
    })
}
