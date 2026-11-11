// Meal plan entries: reading untrusted data, ordering, and the edits the planner makes.
// Every function returns new arrays and leaves its input untouched. Pure and client-safe.

import { LIMITS, type MealSlot, type PlanEntry } from '@/lib/domain/types'
import { scaleIngredient, servingsNumber } from '@/lib/recipe/ingredients'
import { isHeadingLine } from '@/lib/recipe/text'
import { addDays, daysBetween, isISODate } from './week'

export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

export const MEAL_LABELS: Record<MealSlot, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
}

/** Plans keep half a year of history; older days are pruned on every write. */
export const PLAN_HISTORY_DAYS = 26 * 7

export const PLAN_FULL_MESSAGE = 'Your plan is full. Clear a past week, then try again.'

export function isMealSlot(value: unknown): value is MealSlot {
    return typeof value === 'string' && (MEAL_SLOTS as readonly string[]).includes(value)
}

export function cleanServings(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    const n = Math.round(value)
    return n >= 1 && n <= LIMITS.planServings ? n : null
}

function cleanNote(value: unknown): string {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, LIMITS.planNote) : ''
}

function cleanTime(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

/** Reads stored or imported entries, dropping anything that is not a usable entry. */
export function planEntriesFrom(value: unknown): PlanEntry[] {
    if (!Array.isArray(value)) return []
    const out: PlanEntry[] = []
    const ids = new Set<string>()
    for (const raw of value) {
        if (!raw || typeof raw !== 'object') continue
        const v = raw as Record<string, unknown>
        if (typeof v.id !== 'string' || !v.id || ids.has(v.id) || !isISODate(v.date)) continue
        const recipeId = typeof v.recipeId === 'string' && v.recipeId ? v.recipeId : null
        const note = recipeId ? '' : cleanNote(v.note)
        if (!recipeId && !note) continue
        ids.add(v.id)
        out.push({
            id: v.id,
            date: v.date,
            meal: isMealSlot(v.meal) ? v.meal : 'dinner',
            recipeId,
            note,
            servings: recipeId ? cleanServings(v.servings) : null,
            groceryAddedAt: recipeId ? cleanTime(v.groceryAddedAt) : null,
            createdAt: cleanTime(v.createdAt) ?? 0,
        })
    }
    return out
}

/** By date, then breakfast to snack, then the order they were added. */
export function compareEntries(a: PlanEntry, b: PlanEntry): number {
    return (
        a.date.localeCompare(b.date) ||
        MEAL_SLOTS.indexOf(a.meal) - MEAL_SLOTS.indexOf(b.meal) ||
        a.createdAt - b.createdAt ||
        a.id.localeCompare(b.id)
    )
}

export function sortEntries(entries: readonly PlanEntry[]): PlanEntry[] {
    return entries.toSorted(compareEntries)
}

/** Entries from `start` through the six days after it. */
export function entriesInWeek(entries: readonly PlanEntry[], start: string): PlanEntry[] {
    return sortEntries(
        entries.filter((e) => {
            const d = daysBetween(start, e.date)
            return d >= 0 && d < 7
        }),
    )
}

/** Drops days more than PLAN_HISTORY_DAYS before `today`. */
export function prunePlan(entries: readonly PlanEntry[], today: string): PlanEntry[] {
    const cutoff = addDays(today, -PLAN_HISTORY_DAYS)
    return entries.filter((e) => e.date >= cutoff)
}

export class PlanLimitError extends Error {
    constructor() {
        super(PLAN_FULL_MESSAGE)
        this.name = 'PlanLimitError'
    }
}

/**
 * What a store saves after a mutation: pruned, sorted, and refused when it grows past
 * the cap. A plan that is already over the cap can still shrink.
 */
export function finalizePlan(previous: readonly PlanEntry[], next: readonly PlanEntry[], today: string): PlanEntry[] {
    const kept = sortEntries(prunePlan(next, today))
    if (kept.length > LIMITS.planEntries && kept.length > previous.length) throw new PlanLimitError()
    return kept
}

/** The same dish on the same day and meal, so copies and imports never double up. */
export function sameMeal(a: PlanEntry, b: PlanEntry): boolean {
    if (a.date !== b.date || a.meal !== b.meal) return false
    if (a.recipeId || b.recipeId) return a.recipeId === b.recipeId
    return a.note.toLowerCase() === b.note.toLowerCase()
}

export function addEntries(entries: readonly PlanEntry[], added: readonly PlanEntry[]): PlanEntry[] {
    const ids = new Set(entries.map((e) => e.id))
    return sortEntries([...entries, ...added.filter((e) => !ids.has(e.id))])
}

export interface EntryPatch {
    date?: string
    meal?: MealSlot
    servings?: number | null
}

/** Returns the new list and the edited entry, or null when the id is not on the plan. */
export function updateEntry(
    entries: readonly PlanEntry[],
    id: string,
    patch: EntryPatch,
): { entries: PlanEntry[]; entry: PlanEntry } | null {
    const index = entries.findIndex((e) => e.id === id)
    const current = entries[index]
    if (!current) return null
    const entry: PlanEntry = {
        ...current,
        ...(patch.date !== undefined ? { date: patch.date } : {}),
        ...(patch.meal !== undefined ? { meal: patch.meal } : {}),
        ...(patch.servings !== undefined && current.recipeId ? { servings: cleanServings(patch.servings) } : {}),
    }
    // A different serving count means different quantities, so the week can be shopped again.
    if (patch.servings !== undefined && entry.servings !== current.servings) entry.groceryAddedAt = null
    return { entries: sortEntries(entries.with(index, entry)), entry }
}

export function removeEntries(
    entries: readonly PlanEntry[],
    match: (entry: PlanEntry) => boolean,
): { entries: PlanEntry[]; removed: PlanEntry[] } {
    const removed: PlanEntry[] = []
    const kept: PlanEntry[] = []
    for (const e of entries) (match(e) ? removed : kept).push(e)
    return { entries: kept, removed }
}

/** Every entry of the week before `start`, moved forward a week, minus what is already planned. */
export function copyWeek(
    entries: readonly PlanEntry[],
    start: string,
    opts: { newId: () => string; now: number },
): PlanEntry[] {
    const previous = entriesInWeek(entries, addDays(start, -7))
    const added: PlanEntry[] = []
    for (const e of previous) {
        const copy: PlanEntry = {
            ...e,
            id: opts.newId(),
            date: addDays(e.date, 7),
            groceryAddedAt: null,
            createdAt: opts.now,
        }
        if ([...entries, ...added].some((x) => sameMeal(x, copy))) continue
        added.push(copy)
    }
    return added
}

/** Distinct recipes on a list of entries, in plan order. */
export function plannedRecipeIds(entries: readonly PlanEntry[]): string[] {
    return [...new Set(entries.flatMap((e) => (e.recipeId ? [e.recipeId] : [])))]
}

/** Recipe entries whose ingredients should go on the list: the unshopped ones, or all with `again`. */
export function entriesToShop(entries: readonly PlanEntry[], again = false): PlanEntry[] {
    return entries.filter((e) => e.recipeId && (again || e.groceryAddedAt === null))
}

export interface ShoppableRecipe {
    id: string
    servings: string
    ingredients: readonly string[]
}

/** Servings multiplier for an entry; 1 when either count is unknown. */
export function entryScale(entry: Pick<PlanEntry, 'servings'>, recipeServings: string): number {
    const base = servingsNumber(recipeServings)
    if (entry.servings === null || base === null || base <= 0) return 1
    return entry.servings / base
}

/**
 * Ingredient lines for each entry, scaled to its servings, grouped by recipe so the
 * grocery list can credit each one. Entries whose recipe is gone are skipped.
 */
export function groceryLinesFor(
    entries: readonly PlanEntry[],
    recipes: ReadonlyMap<string, ShoppableRecipe>,
): Array<{ entryId: string; recipeId: string; lines: string[] }> {
    const out: Array<{ entryId: string; recipeId: string; lines: string[] }> = []
    for (const entry of entries) {
        const recipe = entry.recipeId ? recipes.get(entry.recipeId) : undefined
        if (!recipe) continue
        const scale = entryScale(entry, recipe.servings)
        const lines = recipe.ingredients
            .filter((line) => line.trim() && !isHeadingLine(line))
            .map((line) => scaleIngredient(line, scale))
        out.push({ entryId: entry.id, recipeId: recipe.id, lines })
    }
    return out
}

/** The meal to suggest when adding to a day: dinner, unless dinner is already planned there. */
export function suggestedMeal(entries: readonly PlanEntry[], date: string): MealSlot {
    const taken = new Set(entries.filter((e) => e.date === date).map((e) => e.meal))
    if (!taken.has('dinner')) return 'dinner'
    return MEAL_SLOTS.find((slot) => !taken.has(slot)) ?? 'dinner'
}
