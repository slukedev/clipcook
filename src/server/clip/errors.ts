export type ClipErrorCode =
    | 'INVALID_URL'
    | 'BLOCKED_ADDRESS'
    | 'TIMEOUT'
    | 'TOO_LARGE'
    | 'NOT_HTML'
    | 'SITE_BLOCKED'
    | 'NOT_FOUND'
    | 'RATE_LIMITED'
    | 'UPSTREAM'
    | 'TOO_MANY_REDIRECTS'
    | 'NETWORK'
    | 'NO_RECIPE'
    | 'BAD_IMAGE'

export class ClipError extends Error {
    readonly code: ClipErrorCode
    readonly status: number | undefined

    constructor(code: ClipErrorCode, detail?: string, status?: number) {
        super(detail ? `${code}: ${detail}` : code)
        this.name = 'ClipError'
        this.code = code
        this.status = status
    }
}

const MESSAGES: Record<ClipErrorCode, string> = {
    INVALID_URL: 'Enter a full web address.',
    BLOCKED_ADDRESS: 'That address cannot be clipped.',
    TIMEOUT: 'That site took too long. Try again.',
    TOO_LARGE: 'That page is too large to clip.',
    NOT_HTML: 'That link is not a web page.',
    SITE_BLOCKED: 'That site blocked ClipCook. Try the bookmarklet.',
    NOT_FOUND: 'That page was not found. Check the link.',
    RATE_LIMITED: 'That site is busy. Try again in a minute.',
    UPSTREAM: 'That site had a problem. Try again later.',
    TOO_MANY_REDIRECTS: 'That link redirects too many times.',
    NETWORK: 'Could not reach that site. Check the link.',
    NO_RECIPE: 'No recipe found on that page. Try pasting the text.',
    BAD_IMAGE: 'That image could not be used.',
}

export function clipErrorMessage(err: unknown): string {
    if (err instanceof ClipError) return MESSAGES[err.code]
    return 'Could not clip that page. Try again.'
}
