import { type NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/server/db'
import { clearDisplayCookie, displayFromRequest } from '@/server/display-auth'

/** "Unlink" pressed on the display itself: deletes its record and forgets the cookie. */
export async function DELETE(req: NextRequest) {
    const display = await displayFromRequest(req)
    if (display) {
        await (await getStore()).deleteDisplay(display.uid, display.id).catch(() => undefined)
    }
    const res = new NextResponse(null, { status: 204 })
    clearDisplayCookie(res)
    return res
}
