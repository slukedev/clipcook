import 'server-only'

import { getRecipe, listDisplays } from '@/server/queries'
import type { DisplayOption } from './types'

/** The user's displays for a send menu, each with the title of what it shows now. */
export async function displayOptions(uid: string): Promise<DisplayOption[]> {
    const displays = await listDisplays(uid)
    const ids = [...new Set(displays.flatMap((d) => (d.current ? [d.current.recipeId] : [])))]
    const recipes = await Promise.all(ids.map((id) => getRecipe(uid, id).catch(() => null)))
    const titles = new Map(recipes.flatMap((r) => (r ? [[r.id, r.title] as const] : [])))
    return displays.map((d) => {
        const title = d.current ? titles.get(d.current.recipeId) : undefined
        const step = d.current?.step
        return {
            id: d.id,
            name: d.name,
            current: d.current,
            lastSeenAt: d.lastSeenAt,
            showing: title ? (typeof step === 'number' ? `${title}, step ${step + 1}` : title) : null,
        }
    })
}
