import type { NextRequest } from 'next/server'
import { getSession } from '@/server/auth'
import { getStore } from '@/server/db'
import { displayFromRequest } from '@/server/display-auth'
import { decodeImageDataUrl, inlineImageVersion } from '@/server/inline-images'

/**
 * An inline (data URL) recipe photo as a real image response, for the signed-in
 * cook or a display linked to them. URLs carry a content hash, so the browser keeps
 * them for a year and revalidates with the ETag after that.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; kind: string }> }) {
    const { id, kind } = await params
    if (kind !== 'thumb' && kind !== 'photo') return new Response(null, { status: 404 })
    const uid = (await getSession())?.uid ?? (await displayFromRequest(req))?.uid
    if (!uid) return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } })

    const record = await (await getStore()).getRecipe(uid, id)
    const src = kind === 'thumb' ? record?.thumbnail || record?.image : record?.image
    const image = src ? decodeImageDataUrl(src) : null
    if (!src || !image) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })

    const etag = `"${inlineImageVersion(src)}"`
    const headers = {
        'Content-Type': image.type,
        'Cache-Control': 'private, max-age=31536000, immutable',
        ETag: etag,
        'X-Content-Type-Options': 'nosniff',
    }
    if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers })
    return new Response(new Uint8Array(image.bytes), { headers })
}
