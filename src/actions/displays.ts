'use server'

import type { ActionResult, KitchenDisplay } from '@/lib/domain/types'
import { fail, invalidateApp, ok, withUser } from '@/server/action-utils'
import * as displays from '@/server/displays'
import { rateLimit } from '@/server/rate-limit'
import { displayContentSchema, displayNameSchema, idSchema } from '@/server/schemas'

const NOT_FOUND = 'That display was removed.'

const CLAIM_ERRORS: Record<displays.ClaimError, string> = {
    invalid_code: 'That code did not match. Check the display and try again.',
    expired: 'That code expired. Refresh the display for a new one.',
    already_claimed: 'That display is already linked.',
    too_many_displays: 'Remove a display before adding another.',
}

/** Links the display showing `code` to this account. Rate limited per user against guessing. */
export async function claimDisplayCode(code: string, name: string): Promise<ActionResult<KitchenDisplay>> {
    return withUser(async ({ user, store }) => {
        const limit = rateLimit('pairClaim', user.uid)
        if (!limit.ok) return fail('Too many tries. Wait a few minutes and try again.')
        const cleanName = displayNameSchema.safeParse(name)
        const result = await displays.claimDisplayCode(
            store,
            user.uid,
            typeof code === 'string' ? code : '',
            cleanName.success ? cleanName.data : 'Kitchen display',
        )
        if (!result.ok) return fail(CLAIM_ERRORS[result.error])
        invalidateApp()
        return ok(result.display)
    })
}

export async function renameDisplay(id: string, name: string): Promise<ActionResult> {
    return withUser(async ({ user, store }) => {
        await displays.renameDisplay(store, user.uid, idSchema.parse(id), displayNameSchema.parse(name))
        invalidateApp()
        return ok(undefined)
    }, NOT_FOUND)
}

/** Unlinks the display; its cookie stops working on its next poll. */
export async function removeDisplay(id: string): Promise<ActionResult> {
    return withUser(async ({ user, store }) => {
        await displays.removeDisplay(store, user.uid, idSchema.parse(id))
        invalidateApp()
        return ok(undefined)
    }, NOT_FOUND)
}

/**
 * Shows a recipe (and optionally a step and scale) on a display. Cheap enough to call
 * on every step change: one transaction, no page invalidation, no write when nothing changed.
 */
export async function sendToDisplay(
    id: string,
    content: { recipeId: string; step?: number | null; scale?: number },
): Promise<ActionResult<{ version: number }>> {
    return withUser(async ({ user, store }) => {
        const parsed = displayContentSchema.parse(content)
        const saved = await displays.sendToDisplay(store, user.uid, idSchema.parse(id), parsed)
        return ok({ version: saved.version })
    }, NOT_FOUND)
}

export async function clearDisplay(id: string): Promise<ActionResult> {
    return withUser(async ({ user, store }) => {
        await displays.clearDisplay(store, user.uid, idSchema.parse(id))
        return ok(undefined)
    }, NOT_FOUND)
}
