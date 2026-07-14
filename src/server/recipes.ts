import 'server-only'

import { cache } from 'react'
import { adminDb } from './firebase-admin'
import {
    deleteRecipeImages,
    processInlineRecipeImage,
    processRecipeImage,
    seedColorFromDataUrl,
    storageAvailable,
    storeRecipeImages,
} from './images'
import type { RecipeFields } from './schemas'

const COLLECTION = 'allRecipes'

export interface RecipeSummary {
    id: string
    title: string
    /** Storage URL for new docs, base64 data URL for legacy docs, '' if none. */
    thumbnail: string
    seedColor: number | null
}

export interface Recipe extends RecipeFields {
    id: string
    uid: string
    notes: string
    /** Display image: Storage URL for new docs, base64 data URL for legacy. */
    image: string
    thumbnail: string
    seedColor: number | null
    /** True when the photo lives in Firebase Storage (new shape). */
    hasStorageImages: boolean
}

/** The photo a save operation should end up with. */
export type PhotoSource = { kind: 'file'; file: File } | { kind: 'dataUrl'; dataUrl: string } | { kind: 'keep' }

function col() {
    return adminDb().collection(COLLECTION)
}

export const listRecipesForUser = cache(async (uid: string): Promise<RecipeSummary[]> => {
    // Project only what the list renders. Never select the legacy `image`
    // field here — it can be ~900 KB of base64 per doc.
    const snapshot = await col().where('uid', '==', uid).select('title', 'thumbnail', 'thumbnailUrl', 'seedColor').get()
    const results: RecipeSummary[] = []
    snapshot.forEach((doc) => {
        const data = doc.data()
        results.push({
            id: doc.id,
            title: typeof data.title === 'string' ? data.title : '',
            thumbnail:
                typeof data.thumbnailUrl === 'string' && data.thumbnailUrl
                    ? data.thumbnailUrl
                    : typeof data.thumbnail === 'string'
                      ? data.thumbnail
                      : '',
            seedColor: typeof data.seedColor === 'number' ? data.seedColor : null,
        })
    })
    results.sort((a, b) => a.title.localeCompare(b.title))
    return results
})

export const getRecipeForUser = cache(async (uid: string, recipeId: string): Promise<Recipe | null> => {
    const doc = await col().doc(recipeId).get()
    if (!doc.exists) return null
    const data = doc.data()
    if (!data || data.uid !== uid) return null

    const hasStorageImages = typeof data.imageUrl === 'string' && data.imageUrl.length > 0
    const recipe: Recipe = {
        id: doc.id,
        uid: data.uid,
        image: hasStorageImages ? data.imageUrl : String(data.image ?? ''),
        thumbnail:
            typeof data.thumbnailUrl === 'string' && data.thumbnailUrl
                ? data.thumbnailUrl
                : String(data.thumbnail ?? ''),
        seedColor: typeof data.seedColor === 'number' ? data.seedColor : null,
        hasStorageImages,
        title: String(data.title ?? ''),
        description: String(data.description ?? ''),
        servings: data.servings ?? '',
        prepTime: String(data.prepTime ?? ''),
        cookTime: String(data.cookTime ?? ''),
        totalTime: String(data.totalTime ?? ''),
        notes: String(data.notes ?? ''),
        ingredients: Array.isArray(data.ingredients) ? data.ingredients.map(String) : [],
        instructions: Array.isArray(data.instructions) ? data.instructions.map(String) : [],
    }

    // Legacy docs without a seed color: extract it inline (a 64px sample —
    // milliseconds) so dynamic theming works on the very first view, then
    // persist it without blocking the response. Failures fall back to the
    // baseline theme.
    if (recipe.seedColor === null && recipe.image.startsWith('data:')) {
        try {
            recipe.seedColor = await seedColorFromDataUrl(recipe.image)
            const seedColor = recipe.seedColor
            void col()
                .doc(doc.id)
                .update({ seedColor })
                .catch(() => undefined)
        } catch {
            // Best-effort only.
        }
    }

    return recipe
})

async function preparePhotoFields(
    uid: string,
    recipeId: string,
    photo: Exclude<PhotoSource, { kind: 'keep' }>,
): Promise<Record<string, unknown>> {
    const buffer =
        photo.kind === 'file'
            ? Buffer.from(await photo.file.arrayBuffer())
            : Buffer.from(photo.dataUrl.slice(photo.dataUrl.indexOf(',') + 1), 'base64')

    if (await storageAvailable()) {
        const processed = await processRecipeImage(buffer)
        const stored = await storeRecipeImages(uid, recipeId, processed)
        return {
            ...stored,
            seedColor: processed.seedColor,
            // Clear the legacy inline fields — the photo now lives in Storage.
            image: '',
            thumbnail: '',
        }
    }

    // No Storage bucket on this project (Spark plan): keep the photo inline,
    // but server-processed (WebP + seed color) and capped for the 1 MiB doc.
    const inline = await processInlineRecipeImage(buffer)
    return {
        image: inline.image,
        thumbnail: inline.thumbnail,
        seedColor: inline.seedColor,
        imagePath: null,
        thumbnailPath: null,
        imageUrl: null,
        thumbnailUrl: null,
    }
}

export async function createRecipeForUser(uid: string, fields: RecipeFields, photo: PhotoSource): Promise<string> {
    if (photo.kind === 'keep') throw new Error('PHOTO_REQUIRED')
    const ref = col().doc()
    const photoFields = await preparePhotoFields(uid, ref.id, photo)
    const now = Date.now()
    await ref.set({ ...fields, ...photoFields, uid, createdAt: now, updatedAt: now })
    return ref.id
}

export async function updateRecipeForUser(
    uid: string,
    recipeId: string,
    fields: RecipeFields,
    photo: PhotoSource,
): Promise<void> {
    const ref = col().doc(recipeId)

    // Process outside the transaction (sharp + Storage upload are slow);
    // ownership is still enforced before any doc write, and an upload for a
    // doc the user doesn't own is unreachable (the path embeds their uid).
    let photoFields: Record<string, unknown> | null = null
    if (photo.kind !== 'keep') {
        const snap = await ref.get()
        const existing = snap.data()
        if (!snap.exists || !existing || existing.uid !== uid) throw new Error('NOT_FOUND')
        photoFields = await preparePhotoFields(uid, recipeId, photo)
    }

    await adminDb().runTransaction(async (tx) => {
        const snap = await tx.get(ref)
        if (!snap.exists) throw new Error('NOT_FOUND')
        const existing = snap.data()
        if (!existing || existing.uid !== uid) throw new Error('FORBIDDEN')
        tx.set(
            ref,
            {
                ...fields,
                // Keep the current photo fields when the photo didn't change.
                ...(photoFields ?? {
                    image: existing.image ?? '',
                    thumbnail: existing.thumbnail ?? '',
                    imagePath: existing.imagePath ?? null,
                    thumbnailPath: existing.thumbnailPath ?? null,
                    imageUrl: existing.imageUrl ?? null,
                    thumbnailUrl: existing.thumbnailUrl ?? null,
                    seedColor: existing.seedColor ?? null,
                }),
                uid,
                createdAt: existing.createdAt ?? Date.now(),
                updatedAt: Date.now(),
            },
            { merge: false },
        )
    })
}

export async function deleteRecipeForUser(uid: string, recipeId: string): Promise<void> {
    const ref = col().doc(recipeId)
    await adminDb().runTransaction(async (tx) => {
        const snap = await tx.get(ref)
        if (!snap.exists) throw new Error('NOT_FOUND')
        const existing = snap.data()
        if (!existing || existing.uid !== uid) throw new Error('FORBIDDEN')
        tx.delete(ref)
    })
    // Best-effort: an orphaned object costs pennies; a failed delete after the
    // doc is gone must not surface as an error.
    try {
        await deleteRecipeImages(uid, recipeId)
    } catch {
        // ignore
    }
}
