import type { NextRequest } from 'next/server'
import { safeEqual } from '@/server/crypto'
import { json, jsonError } from '@/server/http'
import { autoUpdate } from '@/server/updater'

// Vercel Hobby without Fluid compute allows 60 seconds. A run cut short pushes
// nothing (the branch only moves at the end), and the next run starts over.
export const maxDuration = 60

/**
 * Daily auto update, scheduled in vercel.json. With CRON_SECRET set (Vercel sends
 * it as a bearer token) only the scheduler gets in. Without it anyone may call this,
 * so runs are spaced out; a run only installs what upstream already published.
 */
export async function GET(req: NextRequest) {
    const secret = process.env.CRON_SECRET?.trim()
    if (secret) {
        const header = req.headers.get('authorization') ?? ''
        if (!safeEqual(header, `Bearer ${secret}`)) return jsonError(401, 'Unauthorized.')
    }
    const result = await autoUpdate({ throttle: !secret })
    // Callers without the secret learn nothing about this deployment's setup.
    if (!secret) return json({ ok: true })
    if (result.ran && result.error) return jsonError(502, result.error)
    return json(result)
}
