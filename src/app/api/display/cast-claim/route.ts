import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { getStore } from '@/server/db'
import { setDisplayCookie } from '@/server/display-auth'
import { claimCastToken } from '@/server/displays'
import { json, jsonError, readBodyCapped, tooMany } from '@/server/http'
import { clientIp, rateLimit } from '@/server/rate-limit'

const bodySchema = z.object({
    token: z.string().min(16).max(128),
    deviceId: z
        .string()
        .regex(/^[A-Za-z0-9_-]{8,64}$/)
        .nullish(),
    name: z.string().max(40).nullish(),
})

/** The Cast receiver page trades its token for a display cookie (creating or reusing a display). */
export async function POST(req: NextRequest) {
    if (!process.env.NEXT_PUBLIC_CAST_APP_ID) return jsonError(404, 'Casting is not enabled.')
    const limit = rateLimit('castClaim', clientIp(req.headers))
    if (!limit.ok) return tooMany(limit.retryAfter)
    let body: z.infer<typeof bodySchema>
    try {
        body = bodySchema.parse(JSON.parse(new TextDecoder().decode(await readBodyCapped(req, 4096))))
    } catch {
        return jsonError(400, 'Bad request.')
    }
    const result = await claimCastToken(await getStore(), body.token, body.deviceId ?? null, body.name ?? null)
    if (!result) return jsonError(401, 'That cast link expired. Cast again.')
    const res = json({ displayId: result.displayId })
    setDisplayCookie(res, result.cookie)
    return res
}
