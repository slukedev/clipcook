import type { NextRequest } from 'next/server'
import { getStore } from '@/server/db'
import { clearDisplayCookie, displayFromRequest } from '@/server/display-auth'
import { json, jsonError, tooMany } from '@/server/http'
import { rateLimit } from '@/server/rate-limit'

/** Read-only library for a linked display: the owner's recipe summaries, newest first. */
export async function GET(req: NextRequest) {
    const display = await displayFromRequest(req)
    if (!display) {
        const res = jsonError(401, 'This display is not linked.')
        clearDisplayCookie(res)
        return res
    }
    const limit = rateLimit('displayRead', display.id)
    if (!limit.ok) return tooMany(limit.retryAfter)
    const recipes = await (await getStore()).listRecipeSummaries(display.uid)
    return json({ recipes })
}
