import 'server-only'

import type { Recipe, RecipeSummary } from '@/lib/domain/types'
import { LIMITS } from '@/lib/domain/types'
import { deriveTotalMinutes } from '@/lib/recipe/time'
import { normalizeTags } from './db/normalize'
import type { RecipeRecord, Store } from './db/types'
import { StoreError } from './db/types'
import {
    copyRecipeImages,
    deleteRecipeImages,
    processInlineRecipeImage,
    processRecipeImage,
    storageAvailable,
    storeRecipeImages,
} from './images'
import type { PhotoChange, RecipeInput } from './schemas'

type PhotoFields = Pick<RecipeRecord, 'image' | 'thumbnail' | 'seedColor' | 'imagePath' | 'thumbnailPath'>

const NO_PHOTO: PhotoFields = { image: '', thumbnail: '', seedColor: null, imagePath: null, thumbnailPath: null }

async function photoBytes(photo: Extract<PhotoChange, { kind: 'file' | 'dataUrl' }>): Promise<Buffer> {
    return photo.kind === 'file'
        ? Buffer.from(await photo.file.arrayBuffer())
        : Buffer.from(photo.dataUrl.slice(photo.dataUrl.indexOf(',') + 1), 'base64')
}

/**
 * Runs the photo pipeline. Firebase projects with a Storage bucket get WebP files
 * in Storage; everything else (Spark plan, local backend) stores inline data URLs.
 * Returns null when the photo should stay as it is.
 */
export async function preparePhoto(
    store: Store,
    uid: string,
    recipeId: string,
    photo: PhotoChange,
): Promise<PhotoFields | null> {
    if (photo.kind === 'keep') return null
    if (photo.kind === 'remove') return NO_PHOTO
    const bytes = await photoBytes(photo)
    if (store.backend === 'firebase' && (await storageAvailable())) {
        const processed = await processRecipeImage(bytes)
        const stored = await storeRecipeImages(uid, recipeId, processed)
        return {
            image: stored.imageUrl,
            thumbnail: stored.thumbnailUrl,
            seedColor: processed.seedColor,
            imagePath: stored.imagePath,
            thumbnailPath: stored.thumbnailPath,
        }
    }
    const inline = await processInlineRecipeImage(bytes)
    return { ...inline, imagePath: null, thumbnailPath: null }
}

/** Keeps only collection ids the user owns. */
async function ownedCollectionIds(store: Store, uid: string, ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) return []
    const owned = new Set((await store.listCollections(uid)).map((c) => c.id))
    return [...new Set(ids)].filter((id) => owned.has(id))
}

function textFields(input: RecipeInput) {
    return {
        title: input.title,
        description: input.description,
        servings: input.servings,
        prepTime: input.prepTime,
        cookTime: input.cookTime,
        totalTime: input.totalTime,
        totalMinutes: deriveTotalMinutes(input),
        ingredients: input.ingredients,
        instructions: input.instructions,
        notes: input.notes,
        tags: normalizeTags(input.tags),
        sourceUrl: input.sourceUrl,
        sourceName: input.sourceName,
    }
}

export async function createRecipe(
    store: Store,
    uid: string,
    input: RecipeInput,
    photo: PhotoChange,
    now = Date.now(),
): Promise<RecipeRecord> {
    const id = store.newId()
    const [photoFields, collectionIds] = await Promise.all([
        preparePhoto(store, uid, id, photo),
        ownedCollectionIds(store, uid, input.collectionIds),
    ])
    const record: RecipeRecord = {
        id,
        uid,
        ...textFields(input),
        ...(photoFields ?? NO_PHOTO),
        collectionIds,
        favorite: input.favorite,
        cookCount: 0,
        lastCookedAt: null,
        createdAt: now,
        updatedAt: now,
    }
    await store.createRecipe(record)
    return record
}

export async function updateRecipe(
    store: Store,
    uid: string,
    id: string,
    input: RecipeInput,
    photo: PhotoChange,
    now = Date.now(),
): Promise<{ record: RecipeRecord; removedStorage: boolean }> {
    // Check ownership before the slow photo work; the transaction re-checks it.
    const existing = await store.getRecipe(uid, id)
    if (!existing) throw new StoreError('NOT_FOUND')
    const [photoFields, collectionIds] = await Promise.all([
        preparePhoto(store, uid, id, photo),
        ownedCollectionIds(store, uid, input.collectionIds),
    ])
    const record = await store.updateRecipe(uid, id, () => ({
        ...textFields(input),
        ...(photoFields ?? {}),
        collectionIds,
        favorite: input.favorite,
        updatedAt: now,
    }))
    return { record, removedStorage: photo.kind === 'remove' && existing.imagePath !== null }
}

export async function deleteRecipe(store: Store, uid: string, id: string): Promise<RecipeRecord> {
    return store.deleteRecipe(uid, id)
}

/** Best-effort Storage cleanup; an orphaned object costs pennies, a failed delete must not surface. */
export async function cleanupRecipeImages(uid: string, id: string): Promise<void> {
    try {
        await deleteRecipeImages(uid, id)
    } catch {
        // ignore
    }
}

export async function duplicateRecipe(store: Store, uid: string, id: string, now = Date.now()): Promise<RecipeRecord> {
    const source = await store.getRecipe(uid, id)
    if (!source) throw new StoreError('NOT_FOUND')
    const newId = store.newId()
    let photo: PhotoFields = {
        image: source.image,
        thumbnail: source.thumbnail,
        seedColor: source.seedColor,
        imagePath: null,
        thumbnailPath: null,
    }
    if (source.imagePath && source.thumbnailPath) {
        try {
            const copied = await copyRecipeImages(
                uid,
                { imagePath: source.imagePath, thumbnailPath: source.thumbnailPath },
                newId,
            )
            photo = {
                image: copied.imageUrl,
                thumbnail: copied.thumbnailUrl,
                seedColor: source.seedColor,
                imagePath: copied.imagePath,
                thumbnailPath: copied.thumbnailPath,
            }
        } catch {
            photo = NO_PHOTO
        }
    }
    const record: RecipeRecord = {
        ...source,
        ...photo,
        id: newId,
        title: `${source.title} (copy)`.slice(0, LIMITS.title),
        favorite: false,
        cookCount: 0,
        lastCookedAt: null,
        createdAt: now,
        updatedAt: now,
    }
    await store.createRecipe(record)
    return record
}

/** Strips storage bookkeeping before a record crosses into client code. */
export function toRecipe(record: RecipeRecord): Recipe {
    const { uid: _uid, imagePath: _imagePath, thumbnailPath: _thumbnailPath, ...recipe } = record
    return recipe
}

// ---------- compatibility for pages that predate src/server/queries.ts ----------

/** @deprecated Use listRecipes from '@/server/queries'. */
export async function listRecipesForUser(uid: string): Promise<RecipeSummary[]> {
    const { listRecipes } = await import('./queries')
    return listRecipes(uid)
}

/** @deprecated Use getRecipe from '@/server/queries'. */
export async function getRecipeForUser(
    uid: string,
    id: string,
): Promise<(Recipe & { hasStorageImages: boolean }) | null> {
    const { getRecipe } = await import('./queries')
    const recipe = await getRecipe(uid, id)
    return recipe ? { ...recipe, hasStorageImages: recipe.image.startsWith('https://') } : null
}

export type { Recipe, RecipeSummary }
