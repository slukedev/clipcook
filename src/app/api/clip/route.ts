import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { importRecipeFromBookmarklet } from '@/server/autoimport'
import { saveClipDraft } from '@/server/clip-drafts'
import { ClipError, clipErrorMessage } from '@/server/clip/errors'
import { getStore } from '@/server/db'
import { appOrigin, json, readBodyCapped, tooMany } from '@/server/http'
import { clientIp, rateLimit } from '@/server/rate-limit'

const MAX_BODY_BYTES = 1024 * 1024

const payloadSchema = z.object({
    url: z.string().trim().min(1).max(2048),
    title: z.string().max(500).default(''),
    jsonld: z.array(z.string().max(500_000)).max(50).default([]),
    html: z.string().max(MAX_BODY_BYTES).default(''),
})

async function readPayload(req: NextRequest): Promise<unknown> {
    const body = await readBodyCapped(req, MAX_BODY_BYTES)
    const type = req.headers.get('content-type') ?? ''
    if (type.includes('application/json')) return JSON.parse(new TextDecoder().decode(body))
    if (type.includes('multipart/form-data') || type.includes('application/x-www-form-urlencoded')) {
        const form = await new Response(body as BodyInit, { headers: { 'content-type': type } }).formData()
        const text = (key: string) => {
            const v = form.get(key)
            return typeof v === 'string' ? v : undefined
        }
        return {
            url: text('url') ?? req.nextUrl.searchParams.get('url') ?? '',
            title: text('title'),
            html: text('html'),
            jsonld: form.getAll('jsonld').filter((v): v is string => typeof v === 'string'),
        }
    }
    throw new ClipError('INVALID_URL', `unsupported content type ${type}`)
}

function wantsJson(req: NextRequest): boolean {
    return (req.headers.get('accept') ?? '').includes('application/json')
}

/**
 * Bookmarklet ingest. The bookmarklet posts a form from the recipe page in a new tab;
 * we parse what it read, park the result as a 15-minute draft, and send the tab to
 * /clip?draft=. Anything unusable falls back to /clip?url= for a server-side clip.
 */
export async function POST(req: NextRequest) {
    const origin = appOrigin(req)
    const limit = rateLimit('clipIngest', clientIp(req.headers))
    if (!limit.ok) return tooMany(limit.retryAfter)

    const fallbackUrl = req.nextUrl.searchParams.get('url')
    const redirectTo = (path: string) => NextResponse.redirect(new URL(path, origin), 303)
    const fallback = (err: unknown) => {
        if (wantsJson(req))
            return json(
                { error: clipErrorMessage(err) },
                { status: err instanceof ClipError && err.code === 'TOO_LARGE' ? 413 : 422 },
            )
        const pageUrl = fallbackUrl && /^https?:\/\//i.test(fallbackUrl) ? fallbackUrl : null
        return redirectTo(pageUrl ? `/clip?url=${encodeURIComponent(pageUrl)}` : '/clip')
    }

    let payload: z.infer<typeof payloadSchema>
    try {
        const parsed = payloadSchema.safeParse(await readPayload(req))
        if (!parsed.success) return fallback(new ClipError('INVALID_URL'))
        payload = parsed.data
    } catch (err) {
        return fallback(err)
    }

    try {
        const recipe = await importRecipeFromBookmarklet(payload)
        const draftId = await saveClipDraft(await getStore(), recipe)
        const location = `/clip?draft=${draftId}`
        return wantsJson(req) ? json({ draftId, location: new URL(location, origin).toString() }) : redirectTo(location)
    } catch (err) {
        return fallback(err)
    }
}
