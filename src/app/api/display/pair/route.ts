import type { NextRequest } from 'next/server'
import { getStore } from '@/server/db'
import { startPairing } from '@/server/displays'
import { appOrigin, json, tooMany } from '@/server/http'
import { renderQrSvg } from '@/server/qr'
import { clientIp, rateLimit } from '@/server/rate-limit'

/**
 * A display without a cookie asks for a pairing code. The response carries the code,
 * the secret it polls with, and a ready-to-inline QR code for `${origin}/link?code=`.
 */
export async function POST(req: NextRequest) {
    const limit = rateLimit('pairStart', clientIp(req.headers))
    if (!limit.ok) return tooMany(limit.retryAfter)
    const pairing = await startPairing(await getStore())
    const linkUrl = `${appOrigin(req)}/link?code=${pairing.code}`
    const qrSvg = await renderQrSvg(linkUrl)
    return json({ ...pairing, linkUrl, qrSvg })
}
