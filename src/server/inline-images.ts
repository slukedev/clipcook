import 'server-only'

import { createHash } from 'node:crypto'

/**
 * Photos stored inline as data URLs (local backend, Firebase without Storage) are
 * served from /api/images/<id>/<kind>?v=<hash> instead of being written into every
 * page's HTML and RSC payload. The hash changes when the photo does, so responses
 * can be cached forever.
 */
export type InlineImageKind = 'thumb' | 'photo'

export function inlineImageVersion(dataUrl: string): string {
    return createHash('sha1').update(dataUrl).digest('base64url').slice(0, 12)
}

/** A data URL becomes its cacheable route; hosted URLs and '' pass through. */
export function inlineImageUrl(recipeId: string, kind: InlineImageKind, src: string): string {
    if (!src.startsWith('data:')) return src
    return `/api/images/${encodeURIComponent(recipeId)}/${kind}?v=${inlineImageVersion(src)}`
}

export interface DecodedImage {
    type: string
    bytes: Buffer
}

const DATA_URL = /^data:(image\/(?:webp|png|jpeg|gif|avif));base64,([A-Za-z0-9+/=]+)$/

export function decodeImageDataUrl(dataUrl: string): DecodedImage | null {
    const m = DATA_URL.exec(dataUrl)
    if (!m?.[1] || !m[2]) return null
    return { type: m[1], bytes: Buffer.from(m[2], 'base64') }
}
