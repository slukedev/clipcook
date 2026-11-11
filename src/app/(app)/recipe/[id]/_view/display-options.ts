import 'server-only'

import { getStore } from '@/server/db'
import { displayPresence } from '@/server/displays'
import { getRecipe } from '@/server/queries'
import type { DisplayOption } from './types'

/** The user's displays for a send menu: whether each is there, and what it shows now. */
export async function displayOptions(uid: string): Promise<DisplayOption[]> {
    // The store's records, not the public list: presence needs to know which never linked.
    const records = await (await getStore()).listDisplays(uid)
    const ids = [...new Set(records.flatMap((d) => (d.current ? [d.current.recipeId] : [])))]
    const recipes = await Promise.all(ids.map((id) => getRecipe(uid, id).catch(() => null)))
    const titles = new Map(recipes.flatMap((r) => (r ? [[r.id, r.title] as const] : [])))
    const now = Date.now()
    return records.map((d) => {
        const title = d.current ? titles.get(d.current.recipeId) : undefined
        const step = d.current?.step
        return {
            id: d.id,
            name: d.name,
            current: d.current,
            lastSeenAt: d.lastSeenAt,
            presence: displayPresence(d, now),
            showing: title ? (typeof step === 'number' ? `${title}, step ${step + 1}` : title) : null,
        }
    })
}
