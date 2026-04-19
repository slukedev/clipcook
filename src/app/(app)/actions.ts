'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/server/auth'
import { importRecipeFromUrl, type ImportedRecipe } from '@/server/autoimport'
import {
    createRecipeForUser,
    deleteRecipeForUser,
    updateRecipeForUser,
} from '@/server/recipes'
import { importUrlSchema, recipeIdSchema, recipeInputSchema } from '@/server/schemas'

export type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: string }

function toMessage(err: unknown, fallback = 'Something went wrong.'): string {
    if (err instanceof Error) {
        if (err.message === 'NOT_FOUND') return 'Recipe not found.'
        if (err.message === 'FORBIDDEN') return 'You do not have access to that recipe.'
        if (err.message === 'UNAUTHENTICATED') return 'Please sign in again.'
    }
    return fallback
}

export async function createRecipeAction(input: unknown): Promise<ActionResult<string>> {
    try {
        const session = await requireSession()
        const parsed = recipeInputSchema.safeParse(input)
        if (!parsed.success) {
            return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid recipe.' }
        }
        const id = await createRecipeForUser(session.uid, parsed.data)
        revalidatePath('/')
        return { ok: true, data: id }
    } catch (err) {
        return { ok: false, error: toMessage(err) }
    }
}

export async function updateRecipeAction(
    recipeId: string,
    input: unknown,
): Promise<ActionResult<string>> {
    try {
        const session = await requireSession()
        const id = recipeIdSchema.parse(recipeId)
        const parsed = recipeInputSchema.safeParse(input)
        if (!parsed.success) {
            return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid recipe.' }
        }
        await updateRecipeForUser(session.uid, id, parsed.data)
        revalidatePath('/')
        revalidatePath(`/recipe/${id}`)
        return { ok: true, data: id }
    } catch (err) {
        return { ok: false, error: toMessage(err) }
    }
}

export async function deleteRecipeAction(recipeId: string): Promise<ActionResult> {
    try {
        const session = await requireSession()
        const id = recipeIdSchema.parse(recipeId)
        await deleteRecipeForUser(session.uid, id)
        revalidatePath('/')
    } catch (err) {
        return { ok: false, error: toMessage(err) }
    }
    redirect('/')
}

const IMPORT_ERROR_MESSAGES: Record<string, string> = {
    'Upstream timed out': 'The site took too long to respond.',
    'Only http(s) is allowed': 'Only http(s) URLs are supported.',
    'No recipe metadata found on page': 'No recipe metadata found on that page.',
    'Target URL is not an HTML page': 'That URL does not look like a webpage.',
    'Upstream payload too large': 'That page is too large to clip.',
    'Empty response': 'The site sent back an empty response.',
    'Site blocked the request (anti-scraping)': 'The site blocked the request (anti-scraping).',
    'Page not found (404)': 'The page could not be found (404).',
    'Site rate-limited the request (429)': 'The site rate-limited the request (429).',
}

export async function importRecipeAction(url: string): Promise<ActionResult<ImportedRecipe>> {
    try {
        await requireSession()
        const parsed = importUrlSchema.safeParse(url)
        if (!parsed.success) {
            return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid URL.' }
        }
        const data = await importRecipeFromUrl(parsed.data)
        return { ok: true, data }
    } catch (err) {
        if (err instanceof Error) {
            if (err.name === 'AbortError') return { ok: false, error: 'The site took too long to respond.' }
            if (err.message.startsWith('Blocked')) return { ok: false, error: 'That URL is blocked.' }
            if (err.message.startsWith('Too many redirects')) return { ok: false, error: 'That URL redirected too many times.' }
            if (err.message.startsWith('Upstream responded')) {
                const match = /\b(\d{3})\b/.exec(err.message)
                return { ok: false, error: `The site responded with ${match?.[1] ?? 'an error'}.` }
            }
            const mapped = IMPORT_ERROR_MESSAGES[err.message]
            if (mapped) return { ok: false, error: mapped }
        }
        return { ok: false, error: 'Unable to import from that URL.' }
    }
}
