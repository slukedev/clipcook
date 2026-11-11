import { type NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/server/db'
import { clearDisplayCookie, displayFromRequest } from '@/server/display-auth'
import { json, jsonError, tooMany } from '@/server/http'
import { rateLimit } from '@/server/rate-limit'
import { toRecipe } from '@/server/recipes'
import { idSchema } from '@/server/schemas'

/** One full recipe from the display owner's library. ETag follows updatedAt. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const [display, { id }] = await Promise.all([displayFromRequest(req), ctx.params])
    if (!display) {
        const res = jsonError(401, 'This display is not linked.')
        clearDisplayCookie(res)
        return res
    }
    const limit = rateLimit('displayRead', display.id)
    if (!limit.ok) return tooMany(limit.retryAfter)
    const recipeId = idSchema.safeParse(id)
    if (!recipeId.success) return jsonError(404, 'Recipe not found.')
    const record = await (await getStore()).getRecipe(display.uid, recipeId.data)
    if (!record) return jsonError(404, 'Recipe not found.')
    const etag = `"r${record.updatedAt}"`
    const headers = { ETag: etag, 'Cache-Control': 'private, no-cache' }
    if (req.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers })
    return json(toRecipe(record), { headers })
}
