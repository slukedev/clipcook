import 'server-only'

import type { RecipeRecord, Store } from '../db/types'
import { createRecipe } from '../recipes'
import { drawDish } from './dishes'
import { RECIPES } from './recipes'

/**
 * A short, forgiving first set for an empty library: one pan or one bowl, everyday
 * ingredients, and steps that say what done looks like. Newest first in the library.
 */
export const STARTER_KEYS = ['pesto', 'lemonChicken', 'salad', 'pancakes', 'shakshuka'] as const

export const STARTER_RECIPES = STARTER_KEYS.map((key) => {
    const recipe = RECIPES.find((r) => r.key === key)
    if (!recipe) throw new Error(`Unknown starter recipe: ${key}`)
    return recipe
})

/** The drawn photo goes straight into the upload pipeline, which rasterizes SVG itself. */
function photoDataUrl(dish: Parameters<typeof drawDish>[0], seed: string): string {
    return `data:image/svg+xml;base64,${Buffer.from(drawDish(dish, seed)).toString('base64')}`
}

/**
 * Adds the starter recipes the library does not already have (matched by title), so a
 * second press or a retry never duplicates them. Returns the recipes it created.
 */
export async function addStarterRecipes(store: Store, uid: string, now = Date.now()): Promise<RecipeRecord[]> {
    const existing = new Set((await store.listRecipes(uid)).map((r) => r.title.trim().toLowerCase()))
    const missing = STARTER_RECIPES.filter((r) => !existing.has(r.title.toLowerCase()))
    return Promise.all(
        missing.map(async (r, i) => {
            const photo = r.dish ? photoDataUrl(r.dish, r.key) : null
            return createRecipe(
                store,
                uid,
                {
                    title: r.title,
                    description: r.description,
                    servings: r.servings,
                    prepTime: r.prepTime,
                    cookTime: r.cookTime,
                    totalTime: r.totalTime,
                    notes: r.notes ?? '',
                    ingredients: r.ingredients,
                    instructions: r.instructions,
                    tags: r.tags,
                    collectionIds: [],
                    favorite: false,
                    // These are ClipCook's own recipes, so they carry no clipped source.
                    sourceUrl: null,
                    sourceName: null,
                },
                photo ? { kind: 'dataUrl', dataUrl: photo } : { kind: 'remove' },
                // Keep the list order under the default newest-first sort.
                now - i,
            )
        }),
    )
}
