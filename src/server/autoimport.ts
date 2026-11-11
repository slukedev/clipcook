import 'server-only'

import type { ImportedRecipe } from '@/lib/domain/types'
import { ClipError } from './clip/errors'
import { type ExtractedRecipe, extractRecipe } from './clip/extract'
import { decodeHtml, FETCH_BUDGET_MS, MAX_HTML_BYTES, MAX_IMAGE_BYTES, safeFetch, sniffImageType } from './clip/fetch'
import { clipImageDataUrl } from './images'

export type { ImportedRecipe } from '@/lib/domain/types'

export interface ClipOptions {
    /** Tests only: lets a local fixture server stand in for the web. */
    allowPrivate?: boolean
    /** Skip the photo download (used when the caller only needs text). */
    skipImage?: boolean
}

const MIN_IMAGE_BUDGET_MS = 1_000

async function fetchClipImage(
    url: string,
    deadline: number,
    referer: string,
    opts: ClipOptions,
): Promise<string | undefined> {
    if (deadline - Date.now() < MIN_IMAGE_BUDGET_MS) return undefined
    try {
        const res = await safeFetch(url, {
            maxBytes: MAX_IMAGE_BYTES,
            kind: 'image',
            deadline,
            referer,
            allowPrivate: opts.allowPrivate,
        })
        if (!sniffImageType(res.body)) return undefined
        return await clipImageDataUrl(res.body)
    } catch {
        // The photo is optional; a recipe without one is still a good clip.
        return undefined
    }
}

async function finish(extracted: ExtractedRecipe, deadline: number, opts: ClipOptions): Promise<ImportedRecipe> {
    const { imageUrl, method: _method, ...rest } = extracted
    const recipe: ImportedRecipe = rest
    if (imageUrl && !opts.skipImage) {
        const image = await fetchClipImage(imageUrl, deadline, extracted.sourceUrl ?? imageUrl, opts)
        if (image) recipe.image = image
    }
    return recipe
}

function looksLikeHtml(contentType: string, body: Uint8Array): boolean {
    if (/html|xml/.test(contentType)) return true
    if (contentType && !contentType.startsWith('text/plain') && !contentType.startsWith('application/octet-stream')) {
        return false
    }
    const head = new TextDecoder().decode(body.subarray(0, 512)).trimStart().toLowerCase()
    return head.startsWith('<')
}

/** Fetches a page and turns it into a recipe draft. Throws ClipError. */
export async function importRecipeFromUrl(url: string, opts: ClipOptions = {}): Promise<ImportedRecipe> {
    const deadline = Date.now() + FETCH_BUDGET_MS
    const page = await safeFetch(url, {
        maxBytes: MAX_HTML_BYTES,
        kind: 'html',
        deadline,
        allowPrivate: opts.allowPrivate,
    })
    if (!looksLikeHtml(page.contentType, page.body)) throw new ClipError('NOT_HTML', page.contentType)
    const html = decodeHtml(page.body, page.contentType)
    const extracted = extractRecipe(html, page.finalUrl)
    if (!extracted) throw new ClipError('NO_RECIPE')
    return finish(extracted, deadline, opts)
}

export interface BookmarkletPayload {
    url: string
    title?: string
    /** Raw text of every ld+json script on the page. */
    jsonld: string[]
    /** The recipe card's outerHTML plus head meta tags, when the bookmarklet found them. */
    html?: string
}

/**
 * Parses what the bookmarklet read from a page the user already has open. No page
 * fetch happens here (that is the point: sites that block servers still work);
 * only the photo is downloaded, through the same SSRF-safe path.
 */
export async function importRecipeFromBookmarklet(
    payload: BookmarkletPayload,
    opts: ClipOptions = {},
): Promise<ImportedRecipe> {
    let pageUrl: URL
    try {
        pageUrl = new URL(payload.url)
    } catch {
        throw new ClipError('INVALID_URL')
    }
    if (pageUrl.protocol !== 'http:' && pageUrl.protocol !== 'https:') throw new ClipError('INVALID_URL')
    const extracted = extractRecipe(payload.html ?? '', pageUrl.toString(), payload.jsonld)
    if (!extracted) throw new ClipError('NO_RECIPE')
    if (!extracted.title && payload.title) extracted.title = payload.title.trim().slice(0, 200)
    return finish(extracted, Date.now() + FETCH_BUDGET_MS, opts)
}
