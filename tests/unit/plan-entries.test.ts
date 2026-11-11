import { describe, expect, it } from 'vitest'
import { LIMITS, type PlanEntry } from '@/lib/domain/types'
import {
    copyWeek,
    entriesInWeek,
    entriesToShop,
    entryScale,
    finalizePlan,
    groceryLinesFor,
    leadEntry,
    PlanLimitError,
    planEntriesFrom,
    prunePlan,
    removeEntries,
    suggestedMeal,
    updateEntry,
} from '@/lib/plan/entries'
import { addGroceryLines } from '@/lib/recipe/grocery'

function entry(overrides: Partial<PlanEntry> = {}): PlanEntry {
    return {
        id: overrides.id ?? Math.random().toString(36).slice(2),
        date: '2026-11-11',
        meal: 'dinner',
        recipeId: 'r1',
        note: '',
        servings: null,
        groceryAddedAt: null,
        createdAt: 1,
        ...overrides,
    }
}

describe('planEntriesFrom', () => {
    it('drops anything that is not a usable entry', () => {
        const out = planEntriesFrom([
            null,
            'tacos',
            { id: 'a', date: '2026-02-30', meal: 'dinner', recipeId: 'r1' },
            { id: '', date: '2026-11-11', recipeId: 'r1' },
            { id: 'b', date: '2026-11-11', recipeId: null, note: '   ' },
            { id: 'c', date: '2026-11-11', recipeId: 'r1' },
            { id: 'c', date: '2026-11-12', recipeId: 'r2' },
        ])
        expect(out.map((e) => e.id)).toEqual(['c'])
    })

    it('repairs fields it can trust partly', () => {
        const [out] = planEntriesFrom([
            {
                id: 'x',
                date: '2026-11-11',
                meal: 'brunch',
                recipeId: 'r1',
                note: 'ignored for a recipe',
                servings: 1000,
                groceryAddedAt: 'yesterday',
            },
        ])
        expect(out).toEqual({
            id: 'x',
            date: '2026-11-11',
            meal: 'dinner',
            recipeId: 'r1',
            note: '',
            servings: null,
            groceryAddedAt: null,
            createdAt: 0,
        })
    })

    it('keeps notes, trimmed and capped', () => {
        const [out] = planEntriesFrom([
            { id: 'n', date: '2026-11-11', meal: 'lunch', note: `  Eat ${'o'.repeat(500)}` },
        ])
        expect(out?.note.startsWith('Eat oo')).toBe(true)
        expect(out?.note).toHaveLength(LIMITS.planNote)
        expect(out?.recipeId).toBeNull()
    })

    it('returns nothing for a missing plan', () => {
        expect(planEntriesFrom(undefined)).toEqual([])
        expect(planEntriesFrom({ entries: [] })).toEqual([])
    })
})

describe('finalizePlan', () => {
    it('refuses to grow past the cap', () => {
        const full = Array.from({ length: LIMITS.planEntries }, (_, i) => entry({ id: `e${i}` }))
        expect(() => finalizePlan(full, [...full, entry({ id: 'one-more' })], '2026-11-11')).toThrow(PlanLimitError)
    })

    it('still lets an over-full plan shrink', () => {
        const over = Array.from({ length: LIMITS.planEntries + 5 }, (_, i) => entry({ id: `e${i}` }))
        expect(finalizePlan(over, over.slice(1), '2026-11-11')).toHaveLength(LIMITS.planEntries + 4)
    })

    it('prunes days older than 26 weeks and sorts the rest', () => {
        const old = entry({ id: 'old', date: '2026-05-12' })
        const edge = entry({ id: 'edge', date: '2026-05-13' })
        const lunch = entry({ id: 'lunch', date: '2026-11-11', meal: 'lunch', createdAt: 5 })
        const breakfast = entry({ id: 'bf', date: '2026-11-11', meal: 'breakfast', createdAt: 9 })
        expect(finalizePlan([], [lunch, old, breakfast, edge], '2026-11-11').map((e) => e.id)).toEqual([
            'edge',
            'bf',
            'lunch',
        ])
        expect(prunePlan([old], '2026-11-11')).toEqual([])
    })
})

describe('updateEntry', () => {
    it('returns null for an entry that is gone', () => {
        expect(updateEntry([entry({ id: 'a' })], 'b', { date: '2026-11-12' })).toBeNull()
    })

    it('moves to another day and meal', () => {
        const result = updateEntry([entry({ id: 'a' })], 'a', { date: '2026-11-13', meal: 'lunch' })
        expect(result?.entry).toMatchObject({ date: '2026-11-13', meal: 'lunch' })
    })

    it('reopens shopping when servings change, and only then', () => {
        const shopped = entry({ id: 'a', groceryAddedAt: 50, servings: 4 })
        expect(updateEntry([shopped], 'a', { servings: 6 })?.entry.groceryAddedAt).toBeNull()
        expect(updateEntry([shopped], 'a', { servings: 4 })?.entry.groceryAddedAt).toBe(50)
        expect(updateEntry([shopped], 'a', { date: '2026-11-12' })?.entry.groceryAddedAt).toBe(50)
    })

    it('ignores servings on a note', () => {
        const note = entry({ id: 'n', recipeId: null, note: 'Leftovers' })
        expect(updateEntry([note], 'n', { servings: 3 })?.entry.servings).toBeNull()
    })
})

describe('removeEntries', () => {
    it('hands back what it removed so it can be restored', () => {
        const a = entry({ id: 'a', date: '2026-11-09' })
        const b = entry({ id: 'b', date: '2026-11-16' })
        const result = removeEntries([a, b], (e) => entriesInWeek([e], '2026-11-09').length > 0)
        expect(result.removed).toEqual([a])
        expect(result.entries).toEqual([b])
    })
})

describe('copyWeek', () => {
    let n = 0
    const opts = { newId: () => `copy${n++}`, now: 99 }

    it('copies last week a week forward without its shopping state', () => {
        const last = entry({ id: 'a', date: '2026-11-03', meal: 'lunch', servings: 2, groceryAddedAt: 7 })
        const [copy] = copyWeek([last], '2026-11-09', opts)
        expect(copy).toMatchObject({ date: '2026-11-10', meal: 'lunch', servings: 2, groceryAddedAt: null })
        expect(copy?.id).not.toBe('a')
    })

    it('skips meals that are already planned, notes included', () => {
        const plan = [
            entry({ id: 'a', date: '2026-11-03', recipeId: 'r1' }),
            entry({ id: 'b', date: '2026-11-04', recipeId: null, note: 'Leftovers' }),
            entry({ id: 'c', date: '2026-11-10', recipeId: 'r1' }),
            entry({ id: 'd', date: '2026-11-11', recipeId: null, note: 'leftovers' }),
        ]
        expect(copyWeek(plan, '2026-11-09', opts)).toEqual([])
    })

    it('copies nothing from an empty week', () => {
        expect(copyWeek([entry({ date: '2026-11-11' })], '2026-11-09', opts)).toEqual([])
    })
})

describe('shopping a week', () => {
    const curry = { id: 'r1', servings: '4 servings', ingredients: ['# Sauce', '2 cups milk', '1 onion', ''] }
    const toast = { id: 'r2', servings: '', ingredients: ['2 slices bread'] }
    const recipes = new Map([
        [curry.id, curry],
        [toast.id, toast],
    ])

    it('skips shopped entries unless asked again, and notes always', () => {
        const plan = [
            entry({ id: 'a', groceryAddedAt: 10 }),
            entry({ id: 'b' }),
            entry({ id: 'n', recipeId: null, note: 'Eat out' }),
        ]
        expect(entriesToShop(plan).map((e) => e.id)).toEqual(['b'])
        expect(entriesToShop(plan, true).map((e) => e.id)).toEqual(['a', 'b'])
    })

    it('scales to planned servings and skips headings, blanks and missing recipes', () => {
        const lines = groceryLinesFor(
            [entry({ id: 'a', servings: 6 }), entry({ id: 'b', recipeId: 'gone' }), entry({ id: 'c', recipeId: 'r2' })],
            recipes,
        )
        expect(lines).toEqual([
            { entryId: 'a', recipeId: 'r1', lines: ['3 cups milk', '1½ onion'] },
            { entryId: 'c', recipeId: 'r2', lines: ['2 slices bread'] },
        ])
    })

    it('leaves quantities alone when the recipe has no serving count', () => {
        expect(entryScale({ servings: 8 }, '')).toBe(1)
        expect(entryScale({ servings: null }, '4')).toBe(1)
        expect(entryScale({ servings: 2 }, 'Serves 4')).toBe(0.5)
    })

    it('merges the same recipe planned twice into one grocery line', () => {
        const groups = groceryLinesFor(
            [entry({ id: 'a' }), entry({ id: 'b', date: '2026-11-12', servings: 2 })],
            recipes,
        )
        let items = addGroceryLines([], [], { now: 1, newId: () => 'x' })
        let id = 0
        for (const group of groups) {
            items = addGroceryLines(items, group.lines, { recipeId: group.recipeId, now: 1, newId: () => `i${id++}` })
        }
        const milk = items.find((i) => i.name === 'milk')
        expect(milk?.text).toBe('3 cups milk')
        expect(milk?.recipeIds).toEqual(['r1'])
    })
})

describe('suggestedMeal', () => {
    it('suggests dinner, then the first open meal of the day', () => {
        expect(suggestedMeal([], '2026-11-11')).toBe('dinner')
        expect(suggestedMeal([entry({ meal: 'dinner' })], '2026-11-11')).toBe('breakfast')
        expect(suggestedMeal([entry({ meal: 'dinner' })], '2026-11-12')).toBe('dinner')
    })
})

describe('leadEntry', () => {
    const breakfast = entry({ id: 'b', meal: 'breakfast' })
    const dinner = entry({ id: 'd', meal: 'dinner' })
    const note = entry({ id: 'n', meal: 'lunch', recipeId: null, note: 'Eat out' })

    it('leads with the meal coming up at this hour', () => {
        expect(leadEntry([dinner, breakfast], 8)?.id).toBe('b')
        expect(leadEntry([dinner, breakfast], 17)?.id).toBe('d')
    })

    it('prefers something to cook over a note, and returns nothing for an empty day', () => {
        expect(leadEntry([note, dinner], 12)?.id).toBe('d')
        expect(leadEntry([note], 12)?.id).toBe('n')
        expect(leadEntry([], 12)).toBeUndefined()
    })
})
