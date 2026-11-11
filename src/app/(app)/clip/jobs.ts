// What a clip attempt is and how its failure should be answered. Client-safe.

import type { ActionResult, ImportedRecipe } from '@/lib/domain/types'

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

// The server answers with sentences, not codes; these match src/server/clip/errors.ts.
export function classifyClipError(message: string): ClipFailure {
    if (/blocked ClipCook/i.test(message)) return 'blocked'
    if (/no recipe found/i.test(message)) return 'no-recipe'
    if (/session ended|sign in/i.test(message)) return 'session'
    if (/expired/i.test(message)) return 'expired'
    if (
        /full web address|cannot be clipped|not a web page|was not found|redirects too many|too large|too long\. paste/i.test(
            message,
        )
    )
        return 'input'
    return 'retry'
}

export function offlineAwareError(): ClipResult {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    return {
        ok: false,
        error: offline ? 'You are offline. Try again when connected.' : 'Could not reach ClipCook. Try again.',
    }
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
