import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'
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

/**
 * Pre-rendered with `npm run generate:starter-photos`, because rasterizing the drawings
 * takes seconds per photo. Missing files fall back to the drawing.
 */
async function photoDataUrl(dish: Parameters<typeof drawDish>[0], key: string): Promise<string> {
    try {
        // Traced into the server bundle by outputFileTracingIncludes in next.config.js.
        const file = path.join(/*turbopackIgnore: true*/ process.cwd(), 'src/server/starter/photos', `${key}.webp`)
        return `data:image/webp;base64,${(await readFile(file)).toString('base64')}`
    } catch {
        return `data:image/svg+xml;base64,${Buffer.from(drawDish(dish, key)).toString('base64')}`
    }
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
            const photo = r.dish ? await photoDataUrl(r.dish, r.key) : null
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
