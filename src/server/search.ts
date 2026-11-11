import 'server-only'

import { fold } from '@/lib/recipe/search'
import type { Store } from './db/types'

interface Entry {
    updatedAt: number
    haystack: string
}

/**
 * Ingredient text per recipe, kept per server instance and refreshed by updatedAt,
 * so a search reads one cheap summary list instead of every full recipe.
 */
const indexes = new Map<string, Map<string, Entry>>()
const MAX_USERS = 200

async function ingredientIndex(store: Store, uid: string): Promise<Map<string, Entry>> {
    const summaries = await store.listRecipeSummaries(uid)
    const index = indexes.get(uid) ?? new Map<string, Entry>()
    indexes.delete(uid)
    if (indexes.size >= MAX_USERS) indexes.delete(indexes.keys().next().value as string)
    indexes.set(uid, index)

    const live = new Set(summaries.map((s) => s.id))
    for (const id of index.keys()) if (!live.has(id)) index.delete(id)
    const stale = summaries.filter((s) => index.get(s.id)?.updatedAt !== s.updatedAt)
    const records = await Promise.all(stale.map((s) => store.getRecipe(uid, s.id)))
    for (const record of records) {
        if (!record) continue
        index.set(record.id, {
            updatedAt: record.updatedAt,
            haystack: fold(
                [record.title, record.sourceName ?? '', ...record.tags, ...record.ingredients]
                    .map((line) => line.replace(/^# /, ''))
                    .join('\n'),
            ),
        })
    }
    return index
}

/** Ids of recipes whose title, tags, source or ingredients contain every token. */
export async function searchRecipeIds(store: Store, uid: string, tokens: string[]): Promise<string[]> {
    if (tokens.length === 0) return []
    const index = await ingredientIndex(store, uid)
    const ids: string[] = []
    for (const [id, entry] of index) if (tokens.every((t) => entry.haystack.includes(t))) ids.push(id)
    return ids
}
