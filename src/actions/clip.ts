'use server'

import type { ActionResult, ImportedRecipe } from '@/lib/domain/types'
import { parseRecipeText } from '@/lib/recipe/text-import'
import { fail, ok, withUser } from '@/server/action-utils'
import { importRecipeFromUrl } from '@/server/autoimport'
import { loadClipDraft } from '@/server/clip-drafts'
import { rateLimit } from '@/server/rate-limit'
import { httpUrlSchema } from '@/server/schemas'

const SLOW_DOWN = 'Too many clips at once. Try again in a minute.'

/** Fetches and parses a recipe page. Nothing is saved; the editor shows the result. */
export async function clipFromUrl(url: string): Promise<ActionResult<ImportedRecipe>> {
    return withUser(async ({ user }) => {
        const parsed = httpUrlSchema.safeParse(url)
        if (!parsed.success) return fail('Enter a full web address.', 'invalid_url')
        if (!rateLimit('clipUrl', user.uid).ok) return fail(SLOW_DOWN, 'rate_limited')
        return ok(await importRecipeFromUrl(parsed.data))
    })
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/gi

/**
 * Pasted or shared text. A share sheet often sends 'Title https://site/recipe', so
 * text that is mostly one link is clipped from that link instead.
 */
export async function clipFromText(text: string): Promise<ActionResult<ImportedRecipe>> {
    return withUser(async ({ user }) => {
        if (typeof text !== 'string' || !text.trim()) return fail('Paste a recipe first.', 'empty')
        if (text.length > 100_000) return fail('That text is too long. Paste just the recipe.', 'too_long')
        const urls = text.match(URL_IN_TEXT) ?? []
        const rest = text.replace(URL_IN_TEXT, '').trim()
        if (urls.length === 1 && rest.length < 200 && rest.split('\n').length <= 3) {
            const url = (urls[0] as string).replace(/[).,;]+$/, '')
            if (!rateLimit('clipUrl', user.uid).ok) return fail(SLOW_DOWN, 'rate_limited')
            return ok(await importRecipeFromUrl(url))
        }
        const recipe = parseRecipeText(text)
        if (!recipe.ingredients?.length && !recipe.instructions?.length) {
            return fail('No recipe found in that text. Add Ingredients and Instructions headings.', 'no_recipe')
        }
        return ok(recipe)
    })
}

/** The recipe a bookmarklet parked under /clip?draft=<id>. Drafts expire after 15 minutes. */
export async function claimClipDraft(draftId: string): Promise<ActionResult<ImportedRecipe>> {
    return withUser(async ({ store }) => {
        const recipe = typeof draftId === 'string' ? await loadClipDraft(store, draftId) : null
        if (!recipe) return fail('That clip expired. Clip the page again.', 'draft_expired')
        return ok(recipe)
    })
}
