'use server'

import { z } from 'zod'
import type { ActionResult, MealSlot, PlanEntry } from '@/lib/domain/types'
import { LIMITS } from '@/lib/domain/types'
import {
    addEntries,
    copyWeek,
    entriesInWeek,
    entriesToShop,
    groceryLinesFor,
    MEAL_SLOTS,
    planEntriesFrom,
    plannedRecipeIds,
    removeEntries,
    type ShoppableRecipe,
    updateEntry,
} from '@/lib/plan/entries'
import { isISODate } from '@/lib/plan/week'
import { addGroceryLines } from '@/lib/recipe/grocery'
import { fail, invalidateApp, ok, withUser } from '@/server/action-utils'
import type { Store } from '@/server/db/types'
import { idSchema } from '@/server/schemas'

const NOT_FOUND = 'That meal is no longer on the plan.'
const RECIPE_GONE = 'That recipe no longer exists.'

const dateSchema = z.string().refine(isISODate, 'Pick a day.')
const mealSchema = z.enum(MEAL_SLOTS as [MealSlot, ...MealSlot[]])
const servingsSchema = z.number().int().min(1).max(LIMITS.planServings).nullable()
const noteSchema = z.string().trim().min(1, 'Add a note.').max(LIMITS.planNote, 'Keep the note shorter.')

const recipeEntrySchema = z.object({
    id: idSchema.optional(),
    date: dateSchema,
    meal: mealSchema,
    recipeId: idSchema,
    servings: servingsSchema.optional(),
})

const noteEntrySchema = z.object({
    id: idSchema.optional(),
    date: dateSchema,
    meal: mealSchema,
    note: noteSchema,
})

const restoreSchema = z
    .array(
        z.object({
            id: idSchema,
            date: dateSchema,
            meal: mealSchema,
            recipeId: idSchema.nullable(),
            note: z.string().max(LIMITS.planNote),
            servings: servingsSchema,
            groceryAddedAt: z.number().finite().nonnegative().nullable(),
            createdAt: z.number().finite().nonnegative(),
        }),
    )
    .max(LIMITS.planEntries)

class MissingEntry extends Error {}

async function ownsRecipes(store: Store, uid: string, ids: string[]): Promise<boolean> {
    const found = await Promise.all([...new Set(ids)].map((id) => store.getRecipe(uid, id)))
    return found.every(Boolean)
}

async function addEntry(store: Store, uid: string, draft: Omit<PlanEntry, 'id' | 'createdAt'> & { id?: string }) {
    const now = Date.now()
    const out: { entry?: PlanEntry } = {}
    await store.updatePlanEntries(uid, (entries) => {
        // A client-made id lets the screen keep its optimistic row; a clash gets a fresh one.
        const id = draft.id && !entries.some((e) => e.id === draft.id) ? draft.id : store.newId()
        const entry: PlanEntry = { ...draft, id, createdAt: now }
        out.entry = entry
        return addEntries(entries, [entry])
    })
    invalidateApp()
    return out.entry ? ok(out.entry) : fail(NOT_FOUND)
}

/** Plans a recipe for a day and meal. `servings` null cooks the recipe's own amount. */
export async function addPlanRecipe(input: z.input<typeof recipeEntrySchema>): Promise<ActionResult<PlanEntry>> {
    return withUser(async ({ user, store }) => {
        const clean = recipeEntrySchema.parse(input)
        if (!(await ownsRecipes(store, user.uid, [clean.recipeId]))) return fail(RECIPE_GONE, 'not_found')
        return addEntry(store, user.uid, {
            id: clean.id,
            date: clean.date,
            meal: clean.meal,
            recipeId: clean.recipeId,
            note: '',
            servings: clean.servings ?? null,
            groceryAddedAt: null,
        })
    })
}

/** Plans a dish without a recipe: 'Leftovers', 'Eat out', 'Tacos at Sam's'. */
export async function addPlanNote(input: z.input<typeof noteEntrySchema>): Promise<ActionResult<PlanEntry>> {
    return withUser(async ({ user, store }) => {
        const clean = noteEntrySchema.parse(input)
        return addEntry(store, user.uid, {
            id: clean.id,
            date: clean.date,
            meal: clean.meal,
            recipeId: null,
            note: clean.note,
            servings: null,
            groceryAddedAt: null,
        })
    })
}

async function editEntry(
    entryId: string,
    patch: { date?: string; meal?: MealSlot; servings?: number | null },
): Promise<ActionResult<PlanEntry>> {
    return withUser(async ({ user, store }) => {
        const id = idSchema.parse(entryId)
        const out: { entry?: PlanEntry } = {}
        try {
            await store.updatePlanEntries(user.uid, (entries) => {
                const result = updateEntry(entries, id, patch)
                if (!result) throw new MissingEntry()
                out.entry = result.entry
                return result.entries
            })
        } catch (err) {
            if (err instanceof MissingEntry) return fail(NOT_FOUND, 'not_found')
            throw err
        }
        invalidateApp()
        return out.entry ? ok(out.entry) : fail(NOT_FOUND, 'not_found')
    })
}

/** Moves a meal to another day, another meal, or both. Used by drag and drop and the menu. */
export async function movePlanEntry(
    entryId: string,
    to: { date?: string; meal?: MealSlot },
): Promise<ActionResult<PlanEntry>> {
    const parsed = z.object({ date: dateSchema.optional(), meal: mealSchema.optional() }).safeParse(to)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Pick a day.')
    return editEntry(entryId, parsed.data)
}

export async function setPlanServings(entryId: string, servings: number | null): Promise<ActionResult<PlanEntry>> {
    const parsed = servingsSchema.safeParse(servings)
    if (!parsed.success) return fail(`Choose 1 to ${LIMITS.planServings} servings.`)
    return editEntry(entryId, { servings: parsed.data })
}

/** Removes a meal and returns it, so the screen can offer Undo. */
export async function removePlanEntry(entryId: string): Promise<ActionResult<PlanEntry>> {
    return withUser(async ({ user, store }) => {
        const id = idSchema.parse(entryId)
        const out: { entry?: PlanEntry } = {}
        await store.updatePlanEntries(user.uid, (entries) => {
            const result = removeEntries(entries, (e) => e.id === id)
            out.entry = result.removed[0]
            return result.entries
        })
        if (!out.entry) return fail(NOT_FOUND, 'not_found')
        invalidateApp()
        return ok(out.entry)
    })
}

/** Puts removed meals back (Undo). Meals already on the plan are left as they are. */
export async function restorePlanEntries(entries: PlanEntry[]): Promise<ActionResult<PlanEntry[]>> {
    return withUser(async ({ user, store }) => {
        const clean = planEntriesFrom(restoreSchema.parse(entries))
        if (clean.length === 0) return ok([])
        // Recipes deleted since are skipped rather than failing the whole undo.
        const ids = plannedRecipeIds(clean)
        const owned = new Set(
            (await Promise.all(ids.map((id) => store.getRecipe(user.uid, id)))).flatMap((r) => (r ? [r.id] : [])),
        )
        const keep = clean.filter((e) => e.recipeId === null || owned.has(e.recipeId))
        await store.updatePlanEntries(user.uid, (current) => addEntries(current, keep))
        invalidateApp()
        return ok(keep)
    })
}

/** Empties the week starting on `weekStart` and returns what it removed, for Undo. */
export async function clearPlanWeek(weekStart: string): Promise<ActionResult<PlanEntry[]>> {
    return withUser(async ({ user, store }) => {
        const start = dateSchema.parse(weekStart)
        let removed: PlanEntry[] = []
        await store.updatePlanEntries(user.uid, (entries) => {
            const week = new Set(entriesInWeek(entries, start).map((e) => e.id))
            const result = removeEntries(entries, (e) => week.has(e.id))
            removed = result.removed
            return result.entries
        })
        invalidateApp()
        return ok(removed)
    })
}

/** Copies the week before `weekStart` into it, skipping meals that are already planned. */
export async function copyPreviousWeek(weekStart: string): Promise<ActionResult<PlanEntry[]>> {
    return withUser(async ({ user, store }) => {
        const start = dateSchema.parse(weekStart)
        const now = Date.now()
        let added: PlanEntry[] = []
        await store.updatePlanEntries(user.uid, (entries) => {
            added = copyWeek(entries, start, { newId: () => store.newId(), now })
            return addEntries(entries, added)
        })
        invalidateApp()
        return ok(added)
    })
}

export interface WeekGroceryResult {
    /** Distinct recipes whose ingredients went on the list. */
    recipes: number
    /** Ingredient lines added before merging. */
    lines: number
    /** Entries now marked as shopped. */
    entryIds: string[]
    groceryAddedAt: number
}

/**
 * Puts the week's ingredients on the grocery list, each recipe scaled to its planned
 * servings and merged with what is already there. Only meals not added yet, unless
 * `again` is set.
 */
export async function addPlanWeekToGrocery(weekStart: string, again = false): Promise<ActionResult<WeekGroceryResult>> {
    return withUser(async ({ user, store }) => {
        const start = dateSchema.parse(weekStart)
        const shopAgain = z.boolean().parse(again)
        const toShop = entriesToShop(entriesInWeek(await store.getPlanEntries(user.uid), start), shopAgain)
        const now = Date.now()
        const empty = { recipes: 0, lines: 0, entryIds: [], groceryAddedAt: now }
        if (toShop.length === 0) return ok(empty)

        const records = await Promise.all(plannedRecipeIds(toShop).map((id) => store.getRecipe(user.uid, id)))
        const recipes = new Map<string, ShoppableRecipe>(records.flatMap((r) => (r ? [[r.id, r]] : [])))
        const groups = groceryLinesFor(toShop, recipes)
        if (groups.length === 0) return ok(empty)

        await store.updateGroceryItems(user.uid, (items) =>
            groups.reduce(
                (list, group) =>
                    addGroceryLines(list, group.lines, { recipeId: group.recipeId, now, newId: () => store.newId() }),
                items,
            ),
        )
        const shopped = new Set(groups.map((g) => g.entryId))
        await store.updatePlanEntries(user.uid, (entries) =>
            entries.map((e) => (shopped.has(e.id) ? { ...e, groceryAddedAt: now } : e)),
        )
        invalidateApp()
        return ok({
            recipes: new Set(groups.map((g) => g.recipeId)).size,
            lines: groups.reduce((n, g) => n + g.lines.length, 0),
            entryIds: [...shopped],
            groceryAddedAt: now,
        })
    })
}
