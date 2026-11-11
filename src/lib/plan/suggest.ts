// Which recipes to offer when planning: a few smart groups for the picker and a short
// list for an empty tonight. Pure and client-safe.

import type { MealSlot, RecipeSummary } from '@/lib/domain/types'

export type SuggestionKey = 'favorites' | 'quick' | 'lately'

export const QUICK_MINUTES = 30
const LATELY_DAYS = 21
const DAY_MS = 86_400_000

export const SUGGESTION_TITLES: Record<SuggestionKey, string> = {
    favorites: 'Favorites',
    quick: '30 Minutes or Less',
    lately: 'Not Made Lately',
}

type Candidate = Pick<
    RecipeSummary,
    'id' | 'title' | 'favorite' | 'totalMinutes' | 'cookCount' | 'lastCookedAt' | 'tags'
>

const byTitle = (a: Candidate, b: Candidate) => a.title.localeCompare(b.title, undefined, { numeric: true })

export function isQuick(r: Pick<RecipeSummary, 'totalMinutes'>): boolean {
    return r.totalMinutes !== null && r.totalMinutes > 0 && r.totalMinutes <= QUICK_MINUTES
}

/** Cooked before, but not in the last three weeks. */
export function notMadeLately(r: Pick<RecipeSummary, 'cookCount' | 'lastCookedAt'>, now: number): boolean {
    return r.cookCount > 0 && r.lastCookedAt !== null && now - r.lastCookedAt > LATELY_DAYS * DAY_MS
}

const MEAL_TAGS: Record<MealSlot, RegExp> = {
    breakfast: /^(breakfast|brunch)$/,
    lunch: /^(lunch|salad|sandwich(es)?|soup)$/,
    dinner: /^(dinner|weeknight|main|mains|supper)$/,
    snack: /^(snacks?|appetizers?|dessert|desserts|baking)$/,
}

/**
 * How well a recipe's tags suit a meal: 1 when a tag says so, -1 when its tags place it
 * in another meal only (pancakes for dinner, cookies for lunch), 0 when they say nothing.
 */
export function mealFit(tags: readonly string[], meal: MealSlot): number {
    if (tags.some((t) => MEAL_TAGS[meal].test(t))) return 1
    const elsewhere = (Object.keys(MEAL_TAGS) as MealSlot[]).some(
        (other) => other !== meal && tags.some((t) => MEAL_TAGS[other].test(t)),
    )
    return elsewhere ? -1 : 0
}

/**
 * Favorites, quick recipes, and ones not made lately, each recipe in the first group that
 * wants it, the best fits for `meal` first. Empty groups are left out.
 */
export function suggestionGroups<T extends Candidate>(
    recipes: readonly T[],
    now: number,
    meal: MealSlot = 'dinner',
    perGroup = 4,
): Array<{ key: SuggestionKey; title: string; recipes: T[] }> {
    const used = new Set<string>()
    const suits = (r: T) => mealFit(r.tags, meal)
    const take = (list: T[], order: (a: T, b: T) => number) => {
        const picked = list
            .filter((r) => !used.has(r.id))
            .toSorted((a, b) => suits(b) - suits(a) || order(a, b))
            .slice(0, perGroup)
        for (const r of picked) used.add(r.id)
        return picked
    }
    const groups: Array<{ key: SuggestionKey; recipes: T[] }> = [
        {
            key: 'favorites',
            recipes: take(
                recipes.filter((r) => r.favorite),
                (a, b) => b.cookCount - a.cookCount || byTitle(a, b),
            ),
        },
        {
            key: 'quick',
            recipes: take(
                recipes.filter(isQuick),
                (a, b) => (a.totalMinutes ?? 0) - (b.totalMinutes ?? 0) || byTitle(a, b),
            ),
        },
        {
            key: 'lately',
            recipes: take(
                recipes.filter((r) => notMadeLately(r, now)),
                (a, b) => (a.lastCookedAt ?? 0) - (b.lastCookedAt ?? 0) || byTitle(a, b),
            ),
        },
    ]
    return groups.filter((g) => g.recipes.length > 0).map((g) => ({ ...g, title: SUGGESTION_TITLES[g.key] }))
}

/**
 * A few dinners for a night with nothing planned: quick favorites first, then anything
 * quick, then favorites and old standbys. Recipes already planned this week, and ones
 * tagged for another meal only, are skipped.
 */
export function tonightSuggestions<T extends Candidate>(
    recipes: readonly T[],
    now: number,
    exclude: ReadonlySet<string> = new Set(),
    limit = 3,
): T[] {
    const open = recipes.filter((r) => !exclude.has(r.id) && mealFit(r.tags, 'dinner') >= 0)
    const tier = (r: T) =>
        r.favorite && isQuick(r) ? 0 : isQuick(r) ? 1 : r.favorite ? 2 : notMadeLately(r, now) ? 3 : 4
    const minutes = (r: T) => Math.min(r.totalMinutes ?? 4_999, 4_999)
    const rank = (r: T) => tier(r) * 10_000 - mealFit(r.tags, 'dinner') * 5_000 + minutes(r)
    return open.toSorted((a, b) => rank(a) - rank(b) || byTitle(a, b)).slice(0, limit)
}
