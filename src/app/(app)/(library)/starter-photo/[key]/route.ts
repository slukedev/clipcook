import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { STARTER_KEYS } from '@/server/starter'

const KEYS = new Set<string>(STARTER_KEYS)

/** The starter recipes' photos, so an empty library can show what adding them brings. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
    const { key } = await params
    if (!KEYS.has(key)) return new Response(null, { status: 404 })
    try {
        const file = path.join(/*turbopackIgnore: true*/ process.cwd(), 'src/server/starter/photos', `${key}.webp`)
        const bytes = await readFile(file)
        return new Response(new Uint8Array(bytes), {
            headers: {
                'Content-Type': 'image/webp',
                'Cache-Control': 'private, max-age=604800',
                'X-Content-Type-Options': 'nosniff',
            },
        })
    } catch {
        return new Response(null, { status: 404 })
    }
}
