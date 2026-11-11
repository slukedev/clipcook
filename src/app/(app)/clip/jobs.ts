// What a clip attempt is and how its failure should be answered. Client-safe.

import type { ActionResult, ClipFailureCode, ImportedRecipe } from '@/lib/domain/types'

export type ClipJob =
    | { kind: 'url'; value: string }
    | { kind: 'text'; value: string }
    | { kind: 'draft'; value: string }

export type ClipResult = ActionResult<ImportedRecipe>

/** The next step each failure offers, besides editing the input. */
export type ClipFailure =
    | 'blocked' // the site refuses servers: bookmarklet or paste
    | 'no-recipe' // nothing found: paste text or write it
    | 'retry' // timeouts, network, busy: try again
    | 'input' // the link itself is wrong: fix it
    | 'session' // signed out mid-flow
    | 'expired' // bookmarklet draft is gone

const FAILURES: Record<ClipFailureCode, ClipFailure> = {
    blocked: 'blocked',
    no_recipe: 'no-recipe',
    unauthenticated: 'session',
    draft_expired: 'expired',
    invalid_url: 'input',
    blocked_address: 'input',
    not_html: 'input',
    not_found: 'input',
    too_large: 'input',
    too_many_redirects: 'input',
    too_long: 'input',
    empty: 'input',
    timeout: 'retry',
    network: 'retry',
    rate_limited: 'retry',
    upstream: 'retry',
    bad_image: 'retry',
}

/** Unknown or missing codes (an unexpected throw) are worth another try. */
export function classifyClipError(code: string | undefined): ClipFailure {
    return code && Object.hasOwn(FAILURES, code) ? FAILURES[code as ClipFailureCode] : 'retry'
}

export function offlineAwareError(): ClipResult {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    return {
        ok: false,
        error: offline ? 'You are offline. Try again when connected.' : 'Could not reach ClipCook. Try again.',
        code: 'network',
    }
}

/**
 * A source link reduced to what identifies the page: no protocol, www, hash,
 * tracking params or trailing slash, and the rest of the query sorted.
 */
export function normalizeSourceUrl(raw: string): string | null {
    let url: URL
    try {
        url = new URL(raw.trim())
    } catch {
        return null
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    const params = [...url.searchParams]
        .filter(([key]) => !/^utm_/i.test(key))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    const query = new URLSearchParams(params).toString()
    const path = url.pathname.replace(/\/+$/, '')
    return `${host}${url.port ? `:${url.port}` : ''}${path}${query ? `?${query}` : ''}`
}

function normalizeTitle(title: string): string {
    return title.trim().toLowerCase().replace(/\s+/g, ' ')
}

export interface LibraryEntry {
    id: string
    title: string
    sourceUrl: string | null
}

/** The saved recipe this clip repeats: same page first, then same title. */
export function findDuplicate(
    library: LibraryEntry[],
    clip: { title?: string; sourceUrl?: string },
): LibraryEntry | null {
    const source = clip.sourceUrl ? normalizeSourceUrl(clip.sourceUrl) : null
    if (source) {
        const sameSource = library.find((r) => r.sourceUrl && normalizeSourceUrl(r.sourceUrl) === source)
        if (sameSource) return sameSource
    }
    const title = clip.title?.trim() ? normalizeTitle(clip.title) : null
    return title ? (library.find((r) => normalizeTitle(r.title) === title) ?? null) : null
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/i

/** The first web link in some text, without trailing punctuation. */
export function findUrl(text: string): string | null {
    const match = URL_IN_TEXT.exec(text)
    return match ? match[0].replace(/[).,;!?]+$/, '') : null
}

/** True when the text is essentially one link (what a share sheet or a copy usually holds). */
export function isLoneUrl(text: string): boolean {
    const trimmed = text.trim()
    const url = findUrl(trimmed)
    return Boolean(url) && trimmed.replace(URL_IN_TEXT, '').trim().length < 120 && !/\n.*\n/.test(trimmed)
}
