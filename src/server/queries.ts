import 'server-only'

import { cache } from 'react'
import type { Collection, GroceryItem, KitchenDisplay, Recipe, RecipeSummary, TagCount } from '@/lib/domain/types'
import { runAfter } from './after'
import { getStore } from './db'
import { toKitchenDisplay } from './displays'
import { seedColorFromDataUrl } from './images'
import { toRecipe } from './recipes'

export { runAfter } from './after'

/** Library summaries, newest first. Never includes full-size photos. */
export const listRecipes = cache(async (uid: string): Promise<RecipeSummary[]> => {
    return (await getStore()).listRecipeSummaries(uid)
})

export const getRecipe = cache(async (uid: string, id: string): Promise<Recipe | null> => {
    const store = await getStore()
    const record = await store.getRecipe(uid, id)
    if (!record) return null
    const recipe = toRecipe(record)
    // Legacy inline photos never had a seed color; a 64px sample takes milliseconds, so
    // compute it now for this render and persist it after the response.
    if (recipe.seedColor === null && recipe.image.startsWith('data:')) {
        try {
            const seedColor = await seedColorFromDataUrl(recipe.image)
            recipe.seedColor = seedColor
            runAfter(() =>
                store.updateRecipe(uid, id, (current) => (current.seedColor === null ? { seedColor } : null)),
            )
        } catch {
            // Falls back to the app theme.
        }
    }
    return recipe
})

function toCollection(c: { id: string; name: string; createdAt: number }, recipes: RecipeSummary[]): Collection {
    const members = recipes.filter((r) => r.collectionIds.includes(c.id))
    const coverThumbnails = members
        .filter((r) => r.thumbnail)
        .toSorted((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 4)
        .map((r) => r.thumbnail)
    return { id: c.id, name: c.name, createdAt: c.createdAt, recipeCount: members.length, coverThumbnails }
}

export const listCollections = cache(async (uid: string): Promise<Collection[]> => {
    const store = await getStore()
    const [collections, recipes] = await Promise.all([store.listCollections(uid), listRecipes(uid)])
    return collections.map((c) => toCollection(c, recipes))
})

export const getCollection = cache(
    async (uid: string, id: string): Promise<{ collection: Collection; recipes: RecipeSummary[] } | null> => {
        const store = await getStore()
        const [collection, recipes] = await Promise.all([store.getCollection(uid, id), listRecipes(uid)])
        if (!collection) return null
        return {
            collection: toCollection(collection, recipes),
            recipes: recipes.filter((r) => r.collectionIds.includes(id)),
        }
    },
)

/** Every tag in the library with how many recipes use it, most used first. */
export const listTags = cache(async (uid: string): Promise<TagCount[]> => {
    const counts = new Map<string, number>()
    for (const r of await listRecipes(uid)) for (const tag of r.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    return [...counts]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
})

export const getGroceryList = cache(async (uid: string): Promise<GroceryItem[]> => {
    return (await getStore()).getGroceryItems(uid)
})

export const listDisplays = cache(async (uid: string): Promise<KitchenDisplay[]> => {
    return (await (await getStore()).listDisplays(uid)).map(toKitchenDisplay)
})
