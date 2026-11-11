'use server'

import { z } from 'zod'
import type { ActionResult, GroceryItem } from '@/lib/domain/types'
import { LIMITS } from '@/lib/domain/types'
import { lineToGroceryItem, addGroceryLines as mergeLines } from '@/lib/recipe/grocery'
import { fail, invalidateApp, ok, withUser } from '@/server/action-utils'
import { idSchema } from '@/server/schemas'

const itemIdSchema = idSchema
const linesSchema = z.array(z.string().max(LIMITS.shortText)).min(1).max(LIMITS.lines)
const NOT_FOUND = 'That item is no longer on the list.'

class MissingItem extends Error {}

/**
 * Adds ingredient lines (scale them first with scaleIngredient if needed), merging
 * matching items. Returns the whole updated list.
 */
export async function addGroceryLines(lines: string[], recipeId?: string): Promise<ActionResult<GroceryItem[]>> {
    return withUser(async ({ user, store }) => {
        const clean = linesSchema.parse(lines)
        const rid = recipeId === undefined ? undefined : idSchema.parse(recipeId)
        const now = Date.now()
        const items = await store.updateGroceryItems(user.uid, (current) =>
            mergeLines(current, clean, { recipeId: rid, now, newId: () => store.newId() }),
        )
        invalidateApp()
        return ok(items)
    })
}

async function editItem(
    itemId: string,
    edit: (item: GroceryItem) => GroceryItem | null,
): Promise<ActionResult<GroceryItem | null>> {
    return withUser(async ({ user, store }) => {
        const id = itemIdSchema.parse(itemId)
        let result: GroceryItem | null = null
        try {
            await store.updateGroceryItems(user.uid, (items) => {
                const index = items.findIndex((i) => i.id === id)
                const item = items[index]
                if (!item) throw new MissingItem()
                const next = edit(item)
                result = next
                return next ? items.with(index, next) : items.filter((i) => i.id !== id)
            })
        } catch (err) {
            if (err instanceof MissingItem) return fail(NOT_FOUND)
            throw err
        }
        invalidateApp()
        return ok(result)
    })
}

export async function setGroceryChecked(itemId: string, checked: boolean): Promise<ActionResult> {
    const value = z.boolean().safeParse(checked)
    if (!value.success) return fail('Something went wrong. Try again.')
    const res = await editItem(itemId, (item) => ({ ...item, checked: value.data }))
    return res.ok ? ok(undefined) : res
}

/** Rewrites an item's text; quantity, unit, and category are re-derived from it. */
export async function updateGroceryItem(itemId: string, text: string): Promise<ActionResult<GroceryItem>> {
    const clean = z.string().trim().min(1, 'Add some text.').max(LIMITS.shortText).safeParse(text)
    if (!clean.success) return fail(clean.error.issues[0]?.message ?? 'Add some text.')
    const res = await editItem(itemId, (item) => {
        const parsed = lineToGroceryItem(clean.data, { now: item.addedAt, newId: () => item.id })
        return parsed ? { ...parsed, checked: item.checked, recipeIds: item.recipeIds } : item
    })
    if (!res.ok) return res
    return res.data ? ok(res.data) : fail(NOT_FOUND)
}

export async function removeGroceryItem(itemId: string): Promise<ActionResult> {
    const res = await editItem(itemId, () => null)
    return res.ok ? ok(undefined) : res
}

export async function clearCheckedGroceries(): Promise<ActionResult<GroceryItem[]>> {
    return withUser(async ({ user, store }) => {
        const items = await store.updateGroceryItems(user.uid, (current) => current.filter((i) => !i.checked))
        invalidateApp()
        return ok(items)
    })
}

export async function clearGroceries(): Promise<ActionResult> {
    return withUser(async ({ user, store }) => {
        await store.updateGroceryItems(user.uid, () => [])
        invalidateApp()
        return ok(undefined)
    })
}
