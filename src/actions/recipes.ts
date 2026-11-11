'use server'

import { after } from 'next/server'
import { z } from 'zod'
import type { ActionResult } from '@/lib/domain/types'
import { queryTokens } from '@/lib/recipe/search'
import { fail, invalidateApp, ok, withUser } from '@/server/action-utils'
import { normalizeTags } from '@/server/db/normalize'
import * as recipes from '@/server/recipes'
import { idSchema, parseRecipeFormData, tagsSchema } from '@/server/schemas'
import { searchRecipeIds } from '@/server/search'
import { addStarterRecipes as addStarters } from '@/server/starter'

const NOT_FOUND = 'That recipe no longer exists.'

/** FormData fields are described on parseRecipeFormData in src/server/schemas.ts. Returns the new id. */
export async function createRecipe(formData: FormData): Promise<ActionResult<string>> {
    return withUser(async ({ user, store }) => {
        const parsed = parseRecipeFormData(formData)
        if (!parsed.ok) return fail(parsed.error, parsed.code)
        const record = await recipes.createRecipe(store, user.uid, parsed.input, parsed.photo)
        invalidateApp()
        return ok(record.id)
    })
}

export async function updateRecipe(id: string, formData: FormData): Promise<ActionResult<string>> {
    return withUser(async ({ user, store }) => {
        const recipeId = idSchema.parse(id)
        const parsed = parseRecipeFormData(formData)
        if (!parsed.ok) return fail(parsed.error, parsed.code)
        const { removedStorage } = await recipes.updateRecipe(store, user.uid, recipeId, parsed.input, parsed.photo)
        if (removedStorage) after(() => recipes.cleanupRecipeImages(user.uid, recipeId))
        invalidateApp()
        return ok(recipeId)
    }, NOT_FOUND)
}

export async function deleteRecipe(id: string): Promise<ActionResult> {
    return withUser(async ({ user, store }) => {
        const recipeId = idSchema.parse(id)
        const deleted = await recipes.deleteRecipe(store, user.uid, recipeId)
        if (deleted.imagePath) after(() => recipes.cleanupRecipeImages(user.uid, recipeId))
        invalidateApp()
        return ok(undefined)
    }, NOT_FOUND)
}

export async function setFavorite(id: string, value: boolean): Promise<ActionResult> {
    return withUser(async ({ user, store }) => {
        const recipeId = idSchema.parse(id)
        const favorite = z.boolean().parse(value)
        await store.updateRecipe(user.uid, recipeId, (r) => (r.favorite === favorite ? null : { favorite }))
        invalidateApp()
        return ok(undefined)
    }, NOT_FOUND)
}

/** Replaces the tag list; returns it normalized (lowercase, trimmed, deduped, max 20). */
export async function setTags(id: string, tags: string[]): Promise<ActionResult<string[]>> {
    return withUser(async ({ user, store }) => {
        const recipeId = idSchema.parse(id)
        const next = normalizeTags(tagsSchema.parse(tags))
        await store.updateRecipe(user.uid, recipeId, () => ({ tags: next, updatedAt: Date.now() }))
        invalidateApp()
        return ok(next)
    }, NOT_FOUND)
}

/** Replaces the recipe's collections; ids the user does not own are dropped. Returns the saved ids. */
export async function setRecipeCollections(id: string, collectionIds: string[]): Promise<ActionResult<string[]>> {
    return withUser(async ({ user, store }) => {
        const recipeId = idSchema.parse(id)
        const wanted = z.array(idSchema).max(200).parse(collectionIds)
        const owned = new Set((await store.listCollections(user.uid)).map((c) => c.id))
        const next = [...new Set(wanted)].filter((c) => owned.has(c))
        await store.updateRecipe(user.uid, recipeId, () => ({ collectionIds: next }))
        invalidateApp()
        return ok(next)
    }, NOT_FOUND)
}

export async function markCooked(id: string): Promise<ActionResult<{ cookCount: number; lastCookedAt: number }>> {
    return withUser(async ({ user, store }) => {
        const recipeId = idSchema.parse(id)
        const now = Date.now()
        const saved = await store.updateRecipe(user.uid, recipeId, (r) => ({
            cookCount: r.cookCount + 1,
            lastCookedAt: now,
        }))
        invalidateApp()
        return ok({ cookCount: saved.cookCount, lastCookedAt: now })
    }, NOT_FOUND)
}

/** Returns the copy's id. */
export async function duplicateRecipe(id: string): Promise<ActionResult<string>> {
    return withUser(async ({ user, store }) => {
        const copy = await recipes.duplicateRecipe(store, user.uid, idSchema.parse(id))
        invalidateApp()
        return ok(copy.id)
    }, NOT_FOUND)
}

/** Fills an empty library with a few beginner-friendly recipes. Returns how many were added. */
export async function addStarterRecipes(): Promise<ActionResult<number>> {
    return withUser(async ({ user, store }) => {
        const added = await addStarters(store, user.uid)
        invalidateApp()
        return ok(added.length)
    })
}

const searchQuerySchema = z.string().max(200)

/**
 * Recipes matching a library search, ingredients included ("chickpeas"). The library
 * already matches titles and tags locally; this adds what only the full recipe knows,
 * and returns ids so the page stays small.
 */
export async function searchRecipes(query: string): Promise<ActionResult<string[]>> {
    return withUser(async ({ user, store }) => {
        const tokens = queryTokens(searchQuerySchema.parse(query)).slice(0, 8)
        return ok(await searchRecipeIds(store, user.uid, tokens))
    })
}
