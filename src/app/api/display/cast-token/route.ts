import type { NextRequest } from 'next/server'
import { getSession } from '@/server/auth'
import { getStore } from '@/server/db'
import { createCastToken } from '@/server/displays'
import { isSameOrigin, json, jsonError, tooMany } from '@/server/http'
import { rateLimit } from '@/server/rate-limit'

/** A Cast sender (signed in) gets a one-time, two-minute token to hand to its receiver. */
export async function POST(req: NextRequest) {
    if (!process.env.NEXT_PUBLIC_CAST_APP_ID) return jsonError(404, 'Casting is not enabled.')
    if (!isSameOrigin(req)) return jsonError(403, 'Forbidden.')
    const session = await getSession()
    if (!session) return jsonError(401, 'Sign in to cast.')
    const limit = rateLimit('castToken', session.uid)
    if (!limit.ok) return tooMany(limit.retryAfter)
    return json(await createCastToken(await getStore(), session.uid))
}
