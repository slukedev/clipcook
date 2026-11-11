import { describe, expect, it } from 'vitest'
import { isQuick, mealFit, notMadeLately, suggestionGroups, tonightSuggestions } from '@/lib/plan/suggest'

const NOW = Date.UTC(2026, 10, 11)
const DAY = 86_400_000

function recipe(id: string, overrides: Partial<Parameters<typeof isQuick>[0] & Record<string, unknown>> = {}) {
    return {
        id,
        title: id,
        favorite: false,
        totalMinutes: null as number | null,
        cookCount: 0,
        lastCookedAt: null as number | null,
        tags: [] as string[],
        ...overrides,
    }
}

describe('isQuick and notMadeLately', () => {
    it('does not call an unknown or zero time quick', () => {
        expect(isQuick({ totalMinutes: null })).toBe(false)
        expect(isQuick({ totalMinutes: 0 })).toBe(false)
        expect(isQuick({ totalMinutes: 31 })).toBe(false)
        expect(isQuick({ totalMinutes: 30 })).toBe(true)
    })

    it('needs a past cook older than three weeks', () => {
        expect(notMadeLately({ cookCount: 0, lastCookedAt: null }, NOW)).toBe(false)
        expect(notMadeLately({ cookCount: 3, lastCookedAt: NOW - 5 * DAY }, NOW)).toBe(false)
        expect(notMadeLately({ cookCount: 3, lastCookedAt: NOW - 30 * DAY }, NOW)).toBe(true)
    })
})

describe('mealFit', () => {
    it('reads a meal from tags, and only rules a recipe out when tags place it elsewhere', () => {
        expect(mealFit(['weeknight', 'spicy'], 'dinner')).toBe(1)
        expect(mealFit(['breakfast', 'vegetarian'], 'dinner')).toBe(-1)
        expect(mealFit(['baking', 'dessert'], 'lunch')).toBe(-1)
        expect(mealFit(['vegan'], 'dinner')).toBe(0)
        expect(mealFit([], 'breakfast')).toBe(0)
        expect(mealFit(['breakfast'], 'breakfast')).toBe(1)
    })
})

describe('suggestionGroups', () => {
    it('returns nothing for an empty or plain library', () => {
        expect(suggestionGroups([], NOW)).toEqual([])
        expect(suggestionGroups([recipe('a'), recipe('b')], NOW)).toEqual([])
    })

    it('puts each recipe in the first group that wants it', () => {
        const groups = suggestionGroups(
            [
                recipe('fav-quick', { favorite: true, totalMinutes: 20 }),
                recipe('quick', { totalMinutes: 25 }),
                recipe('quicker', { totalMinutes: 10 }),
                recipe('old', { cookCount: 2, lastCookedAt: NOW - 60 * DAY }),
                recipe('older', { cookCount: 1, lastCookedAt: NOW - 90 * DAY }),
            ],
            NOW,
        )
        expect(groups.map((g) => [g.title, g.recipes.map((r) => r.id)])).toEqual([
            ['Favorites', ['fav-quick']],
            ['30 Minutes or Less', ['quicker', 'quick']],
            ['Not Made Lately', ['older', 'old']],
        ])
    })

    it('caps each group', () => {
        const many = Array.from({ length: 9 }, (_, i) => recipe(`q${i}`, { totalMinutes: 15 }))
        expect(suggestionGroups(many, NOW, 'dinner', 4)[0]?.recipes).toHaveLength(4)
    })

    it('leads each group with what suits the meal', () => {
        const list = [
            recipe('pancakes', { totalMinutes: 10, tags: ['breakfast'] }),
            recipe('stir fry', { totalMinutes: 20, tags: ['weeknight'] }),
        ]
        expect(suggestionGroups(list, NOW, 'dinner')[0]?.recipes.map((r) => r.id)).toEqual(['stir fry', 'pancakes'])
        expect(suggestionGroups(list, NOW, 'breakfast')[0]?.recipes.map((r) => r.id)).toEqual(['pancakes', 'stir fry'])
    })
})

describe('tonightSuggestions', () => {
    it('skips what is already planned and prefers quick favorites', () => {
        const picks = tonightSuggestions(
            [
                recipe('slow-fav', { favorite: true, totalMinutes: 240 }),
                recipe('planned', { favorite: true, totalMinutes: 10 }),
                recipe('quick', { totalMinutes: 20 }),
                recipe('quick-fav', { favorite: true, totalMinutes: 25 }),
                recipe('plain'),
            ],
            NOW,
            new Set(['planned']),
        )
        expect(picks.map((r) => r.id)).toEqual(['quick-fav', 'quick', 'slow-fav'])
    })

    it('never suggests pancakes or cookies for dinner', () => {
        const picks = tonightSuggestions(
            [
                recipe('pancakes', { favorite: true, totalMinutes: 15, tags: ['breakfast'] }),
                recipe('cookies', { totalMinutes: 25, tags: ['baking', 'dessert'] }),
                recipe('curry', { totalMinutes: 45, tags: ['weeknight'] }),
            ],
            NOW,
        )
        expect(picks.map((r) => r.id)).toEqual(['curry'])
    })

    it('still suggests something from a library with no times or favorites', () => {
        expect(tonightSuggestions([recipe('b'), recipe('a')], NOW).map((r) => r.id)).toEqual(['a', 'b'])
    })
})
