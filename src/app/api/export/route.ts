import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/server/auth'
import { exportPartStream, planExport } from '@/server/export'
import { checkRateLimit } from '@/server/rate-limit'

// Downloading photos for a large part can take a while. 60 s is the Hobby plan maximum.
export const maxDuration = 60

const docId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const partQuery = z.object({
    part: z.coerce.number().int().min(1).max(1000),
    from: docId,
    to: docId.optional(),
})

const noStore = { 'Cache-Control': 'private, no-store' }

function error(status: number, message: string) {
    return NextResponse.json({ error: message }, { status, headers: noStore })
}

/**
 * Export for the new ClipCook app (Settings > Import).
 *
 * GET /api/export                          → { total, parts: [{ part, from, to, recipes, bytes }] }
 * GET /api/export?part=N&from=ID[&to=ID]   → clipcook-export-N.json (recipes with ids in [from, to))
 *
 * Both require the session cookie and only ever read the signed-in user's recipes.
 */
export async function GET(req: NextRequest) {
    const session = await getSession()
    if (!session) return error(401, 'Sign in to export.')
    if (!checkRateLimit(`export:${session.uid}`, 30, 0.2)) return error(429, 'Too many requests. Try again soon.')

    const params = req.nextUrl.searchParams
    if (!params.has('part')) {
        const plan = await planExport(session.uid)
        return NextResponse.json(plan, { headers: noStore })
    }

    const parsed = partQuery.safeParse({
        part: params.get('part'),
        from: params.get('from') ?? undefined,
        to: params.get('to') ?? undefined,
    })
    if (!parsed.success) return error(400, 'Invalid export request.')
    const { part, from, to } = parsed.data
    if (to !== undefined && to <= from) return error(400, 'Invalid export request.')

    return new Response(exportPartStream(session.uid, from, to ?? null), {
        headers: {
            ...noStore,
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="clipcook-export-${part}.json"`,
            'X-Content-Type-Options': 'nosniff',
        },
    })
}
