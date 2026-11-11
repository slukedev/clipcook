import 'server-only'

import { type NextRequest, NextResponse } from 'next/server'
import { ClipError } from './clip/errors'

/**
 * The public origin for links we hand out (QR codes, bookmarklets, redirects).
 * APP_URL wins; otherwise the forwarded host the platform proxy reports.
 */
export function appOrigin(req: NextRequest): string {
    const configured = process.env.APP_URL?.trim()
    if (configured) {
        try {
            return new URL(configured).origin
        } catch {
            // fall through to the request
        }
    }
    const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host')
    const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.nextUrl.protocol.replace(':', '')
    if (host && /^[A-Za-z0-9.-]+(:\d+)?$/.test(host)) return `${proto === 'http' ? 'http' : 'https'}://${host}`
    return req.nextUrl.origin
}

/** Cookie-authenticated POSTs must come from our own pages (defense in depth on top of SameSite=Lax). */
export function isSameOrigin(req: NextRequest): boolean {
    const origin = req.headers.get('origin')
    if (!origin) return req.headers.get('sec-fetch-site') !== 'cross-site'
    try {
        return (
            new URL(origin).host ===
            (req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host'))
        )
    } catch {
        return false
    }
}

const NO_STORE = { 'Cache-Control': 'no-store' }

export function json(data: unknown, init: ResponseInit = {}): NextResponse {
    return NextResponse.json(data, { ...init, headers: { ...NO_STORE, ...(init.headers ?? {}) } })
}

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}): NextResponse {
    return json({ error, ...extra }, { status })
}

export function tooMany(retryAfter: number): NextResponse {
    const res = jsonError(429, 'Too many requests. Try again shortly.')
    res.headers.set('Retry-After', String(Math.max(1, retryAfter)))
    return res
}

/** Reads a request body up to `maxBytes`, throwing TOO_LARGE past it (a lying Content-Length cannot get around it). */
export async function readBodyCapped(req: Request, maxBytes: number): Promise<Uint8Array> {
    const declared = Number(req.headers.get('content-length') ?? '')
    if (Number.isFinite(declared) && declared > maxBytes) throw new ClipError('TOO_LARGE')
    const reader = req.body?.getReader()
    if (!reader) return new Uint8Array(0)
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > maxBytes) {
            await reader.cancel().catch(() => undefined)
            throw new ClipError('TOO_LARGE')
        }
        chunks.push(value)
    }
    const out = new Uint8Array(total)
    let offset = 0
    for (const c of chunks) {
        out.set(c, offset)
        offset += c.byteLength
    }
    return out
}
