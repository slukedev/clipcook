'use server'

// Compatibility shim for the pre-rebuild editor; new code imports from '@/actions/*'.
import { redirect } from 'next/navigation'
import { clipFromUrl } from '@/actions/clip'
import { createRecipe, deleteRecipe, updateRecipe } from '@/actions/recipes'
import type { ActionResult, ImportedRecipe } from '@/lib/domain/types'

export type { ActionResult } from '@/lib/domain/types'

export async function createRecipeAction(formData: FormData): Promise<ActionResult<string>> {
    return createRecipe(formData)
}

export async function updateRecipeAction(recipeId: string, formData: FormData): Promise<ActionResult<string>> {
    return updateRecipe(recipeId, formData)
}

export async function deleteRecipeAction(recipeId: string): Promise<ActionResult> {
    const result = await deleteRecipe(recipeId)
    if (!result.ok) return result
    redirect('/')
}

export async function importRecipeAction(url: string): Promise<ActionResult<ImportedRecipe>> {
    return clipFromUrl(url)
}
