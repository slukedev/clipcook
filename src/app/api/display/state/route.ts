import { type NextRequest, NextResponse } from 'next/server'
import { runAfter } from '@/server/after'
import { getStore } from '@/server/db'
import { clearDisplayCookie, displayFromRequest } from '@/server/display-auth'
import { displayEtag, needsHeartbeat, toDisplayState } from '@/server/displays'
import { json, jsonError, tooMany } from '@/server/http'
import { rateLimit } from '@/server/rate-limit'

/**
 * The display's poll: one document read. Send If-None-Match with the last ETag to get
 * a bodiless 304 when nothing changed. A 401 means the display was removed; the
 * cookie is cleared and the display should go back to pairing.
 */
export async function GET(req: NextRequest) {
    const display = await displayFromRequest(req)
    if (!display) {
        const res = jsonError(401, 'This display is not linked.')
        clearDisplayCookie(res)
        return res
    }
    const limit = rateLimit('displayRead', display.id)
    if (!limit.ok) return tooMany(limit.retryAfter)

    const now = Date.now()
    if (needsHeartbeat(display, now)) {
        runAfter(async () => (await getStore()).touchDisplay(display.id, now))
    }
    const etag = displayEtag(display)
    const headers = { ETag: etag, 'Cache-Control': 'private, no-cache' }
    if (req.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers })
    return json(toDisplayState(display), { headers })
}
