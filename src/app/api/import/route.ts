import type { NextRequest } from 'next/server'
import { getSession } from '@/server/auth'
import { ImportError, importExport, MAX_IMPORT_BYTES, parseExport } from '@/server/data-transfer'
import { getStore } from '@/server/db'
import { isSameOrigin, json, jsonError, readBodyCapped, tooMany } from '@/server/http'
import { rateLimit } from '@/server/rate-limit'
import { invalidateApp } from '@/server/action-utils'

/**
 * Same as the importData action, for exports over the server-action body limit.
 * Body: multipart with a `file` field, or the export JSON itself. Returns ImportCounts.
 */
export async function POST(req: NextRequest) {
    if (!isSameOrigin(req)) return jsonError(403, 'Forbidden.')
    const session = await getSession()
    if (!session) return jsonError(401, 'Sign in to import.')
    if (!rateLimit('importData', session.uid).ok) return tooMany(600)
    let text: string
    try {
        const body = await readBodyCapped(req, MAX_IMPORT_BYTES + 64 * 1024)
        const type = req.headers.get('content-type') ?? ''
        if (type.includes('multipart/form-data')) {
            const file = (await new Response(body as BodyInit, { headers: { 'content-type': type } }).formData()).get(
                'file',
            )
            if (!(file instanceof File)) return jsonError(400, 'Choose an export file.')
            text = await file.text()
        } else {
            text = new TextDecoder().decode(body)
        }
    } catch {
        return jsonError(413, 'That file is over 25 MB.')
    }
    try {
        const counts = await importExport(await getStore(), session.uid, parseExport(text))
        invalidateApp()
        return json(counts)
    } catch (err) {
        if (err instanceof ImportError) return jsonError(400, err.message)
        throw err
    }
}
