import { type NextRequest, NextResponse } from 'next/server'
import { runAfter } from '@/server/after'
import { getStore } from '@/server/db'
import { clearDisplayCookie, displayFromRequest } from '@/server/display-auth'
import { needsHeartbeat } from '@/server/displays'
import { jsonError } from '@/server/http'

/** Marks the display as seen (at most once a minute) without reading state. */
export async function POST(req: NextRequest) {
    const display = await displayFromRequest(req)
    if (!display) {
        const res = jsonError(401, 'This display is not linked.')
        clearDisplayCookie(res)
        return res
    }
    const now = Date.now()
    if (needsHeartbeat(display, now)) runAfter(async () => (await getStore()).touchDisplay(display.id, now))
    return new NextResponse(null, { status: 204 })
}
