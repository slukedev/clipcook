import { type NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/server/db'
import { displayFromRequest, setDisplayCookie } from '@/server/display-auth'
import { pollPairing } from '@/server/displays'
import { json, tooMany } from '@/server/http'
import { clientIp, rateLimit } from '@/server/rate-limit'

/**
 * Polled by the display while it shows its code. Once a user claims the code, the
 * display gets its long-lived HttpOnly cookie on this response, exactly once.
 * A cookie this browser still holds for another entry of the same screen is retired then.
 * Statuses: pending (keep polling), claimed (reload into the display UI),
 * expired (ask for a new code), not_found (bad pairingId or pollToken).
 */
export async function GET(req: NextRequest) {
    const limit = rateLimit('pairPoll', clientIp(req.headers))
    if (!limit.ok) return tooMany(limit.retryAfter)
    const pairingId = req.nextUrl.searchParams.get('pairingId') ?? ''
    const pollToken = req.headers.get('x-poll-token') ?? req.nextUrl.searchParams.get('pollToken') ?? ''
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(pairingId) || !/^[A-Za-z0-9_-]{16,128}$/.test(pollToken)) {
        return json({ status: 'not_found' }, { status: 404 })
    }
    const result = await pollPairing(await getStore(), pairingId, pollToken, Date.now(), () => displayFromRequest(req))
    if (result.status === 'claimed') {
        const res = json({ status: 'claimed', displayId: result.displayId })
        setDisplayCookie(res, result.cookie)
        return res
    }
    if (result.status === 'not_found') return json({ status: 'not_found' }, { status: 404 })
    if (result.status === 'expired') return json({ status: 'expired' }, { status: 410 })
    return NextResponse.json({ status: 'pending' }, { headers: { 'Cache-Control': 'no-store' } })
}
