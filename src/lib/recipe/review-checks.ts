// What a clip review should ask the cook to look at before saving. Client-safe.

import type { ImportedRecipe } from '@/lib/domain/types'
import { isHeadingLine } from './text'
import { parseDurationToMinutes } from './time'

export type ReviewField = 'title' | 'servings' | 'prepTime' | 'cookTime' | 'totalTime' | 'ingredients' | 'steps'

const SERVINGS =
    /^(?:about\s+|up to\s+)?(?:\d|[½⅓⅔¼¾]|one|two|three|four|five|six|seven|eight|nine|ten|twelve|a dozen)/i
const MAX_MINUTES = 3 * 24 * 60

/**
 * Fields a parser got but may have got wrong: a servings value that is not a number,
 * a time that does not read as a duration, a total shorter than its parts, a step list
 * that never got split, an ingredient line that is really a paragraph.
 */
export function reviewChecks(recipe: ImportedRecipe): Set<ReviewField> {
    const checks = new Set<ReviewField>()
    const title = recipe.title?.trim() ?? ''
    if (!title || title.length > 100 || /^https?:\/\//i.test(title)) checks.add('title')

    const servings = recipe.servings?.trim()
    if (servings && (!SERVINGS.test(servings) || servings.length > 24)) checks.add('servings')

    const minutes: Partial<Record<'prepTime' | 'cookTime' | 'totalTime', number>> = {}
    for (const key of ['prepTime', 'cookTime', 'totalTime'] as const) {
        const value = recipe[key]?.trim()
        if (!value) continue
        const parsed = parseDurationToMinutes(value)
        if (parsed === null || parsed <= 0 || parsed > MAX_MINUTES) checks.add(key)
        else minutes[key] = parsed
    }
    const parts = Math.max(minutes.prepTime ?? 0, minutes.cookTime ?? 0)
    if (minutes.totalTime !== undefined && minutes.totalTime < parts) checks.add('totalTime')

    const ingredients = (recipe.ingredients ?? []).filter((l) => !isHeadingLine(l))
    if (ingredients.length === 0 || ingredients.some((l) => l.length > 160)) checks.add('ingredients')

    const steps = (recipe.instructions ?? []).filter((l) => !isHeadingLine(l))
    if (steps.length === 0 || (steps.length === 1 && (steps[0]?.length ?? 0) > 600)) checks.add('steps')
    return checks
}
