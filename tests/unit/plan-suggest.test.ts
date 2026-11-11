import { describe, expect, it } from 'vitest'
import { isQuick, notMadeLately, suggestionGroups, tonightSuggestions } from '@/lib/plan/suggest'

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
        expect(suggestionGroups(many, NOW, 4)[0]?.recipes).toHaveLength(4)
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

    it('still suggests something from a library with no times or favorites', () => {
        expect(tonightSuggestions([recipe('b'), recipe('a')], NOW).map((r) => r.id)).toEqual(['a', 'b'])
    })
})
