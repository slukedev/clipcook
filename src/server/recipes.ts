import 'server-only'

import { cache } from 'react'
import { adminDb } from './firebase-admin'
import type { RecipeInput } from './schemas'

const COLLECTION = 'allRecipes'

export interface RecipeSummary {
    id: string
    title: string
    image: string
}

export interface Recipe extends RecipeInput {
    id: string
    uid: string
    notes: string
}

function col() {
    return adminDb().collection(COLLECTION)
}

export const listRecipesForUser = cache(async (uid: string): Promise<RecipeSummary[]> => {
    // Only request the fields the list view needs. Pulling the full `image` (a base64
    // data URL up to ~900 KB) for every recipe would balloon the response and defeat
    // the small `thumbnail` that exists precisely for this view, so it is never read
    // here. Legacy recipes saved before thumbnails existed simply render without one
    // until they are re-saved.
    const snapshot = await col().where('uid', '==', uid).select('title', 'thumbnail').get()
    const results: RecipeSummary[] = []
    snapshot.forEach((doc) => {
        const data = doc.data()
        results.push({
            id: doc.id,
            title: typeof data.title === 'string' ? data.title : '',
            image: typeof data.thumbnail === 'string' ? data.thumbnail : '',
        })
    })
    return results
})

export const getRecipeForUser = cache(
    async (uid: string, recipeId: string): Promise<Recipe | null> => {
        const doc = await col().doc(recipeId).get()
        if (!doc.exists) return null
        const data = doc.data()
        if (!data || data.uid !== uid) return null
        return {
            id: doc.id,
            uid: data.uid,
            image: String(data.image ?? ''),
            thumbnail: String(data.thumbnail ?? ''),
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
    },
)

export async function createRecipeForUser(uid: string, input: RecipeInput): Promise<string> {
    const ref = await col().add({ ...input, uid, createdAt: Date.now(), updatedAt: Date.now() })
    return ref.id
}

export async function updateRecipeForUser(
    uid: string,
    recipeId: string,
    input: RecipeInput,
): Promise<void> {
    const ref = col().doc(recipeId)
    await adminDb().runTransaction(async (tx) => {
        const snap = await tx.get(ref)
        if (!snap.exists) throw new Error('NOT_FOUND')
        const existing = snap.data()
        if (!existing || existing.uid !== uid) throw new Error('FORBIDDEN')
        tx.set(
            ref,
            { ...input, uid, createdAt: existing.createdAt ?? Date.now(), updatedAt: Date.now() },
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
}
