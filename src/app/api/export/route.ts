import { getSession } from '@/server/auth'
import { exportStream } from '@/server/data-transfer'
import { getStore } from '@/server/db'
import { jsonError } from '@/server/http'

/** Downloads the whole library as clipcook.export.v1 JSON. */
export async function GET() {
    const session = await getSession()
    if (!session) return jsonError(401, 'Sign in to export.')
    const now = new Date()
    const filename = `clipcook-${now.toISOString().slice(0, 10)}.json`
    return new Response(exportStream(await getStore(), session.uid, now), {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
        },
    })
}
