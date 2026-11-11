import { describe, expect, it } from 'vitest'
import { AISLE_ORDER, groupByAisle, shareText } from '@/app/(app)/grocery/categories'
import { parseHistory, remember, suggestions } from '@/app/(app)/grocery/history'
import { applyOps, compactOps, type GroceryOp, idsAfterAdd, parseQueue, remapOps } from '@/app/(app)/grocery/ops'
import { exportSummary, importedMessage } from '@/app/(app)/settings/_sections/data-summary'
import type { GroceryItem } from '@/lib/domain/types'
import { addGroceryLines } from '@/lib/recipe/grocery'

let n = 0
const newId = () => `srv-${n++}`
const list = (lines: string[]) => addGroceryLines([], lines, { now: 1, newId })

describe('grocery offline queue', () => {
    it('replays queued changes over the server list', () => {
        const base = list(['2 cups milk', '3 limes'])
        const milk = base.find((i) => i.name === 'milk') as GroceryItem
        const ops: GroceryOp[] = [
            { type: 'check', id: milk.id, checked: true },
            { type: 'add', lines: ['1 cup milk', 'bread'], ids: ['tmp-a', 'tmp-b'], now: 2 },
        ]
        const shown = applyOps(base, ops)
        // Checked milk is left alone, so the new milk is its own row.
        expect(shown.map((i) => [i.text, i.checked])).toEqual([
            ['2 cups milk', true],
            ['3 limes', false],
            ['1 cup milk', false],
            ['bread', false],
        ])
    })

    it('maps temporary ids to the ids the server gave so later changes still land', () => {
        const before = list(['3 limes'])
        const op = { type: 'add' as const, lines: ['bread', '2 eggs'], ids: ['tmp-a', 'tmp-b'], now: 5 }
        const saved = addGroceryLines(before, op.lines, { now: 5, newId })
        const ids = idsAfterAdd(before, op, saved)
        expect(ids.size).toBe(2)
        const queued = remapOps([{ type: 'check', id: 'tmp-b', checked: true }, { type: 'clearChecked' }], ids)
        const eggs = saved.find((i) => i.name === 'egg') as GroceryItem
        expect(queued[0]).toEqual({ type: 'check', id: eggs.id, checked: true })
        expect(queued[1]).toEqual({ type: 'clearChecked' })
    })

    it('keeps only the last of repeated checks on one row', () => {
        const ops = compactOps([
            { type: 'check', id: 'a', checked: true },
            { type: 'check', id: 'a', checked: false },
            { type: 'check', id: 'b', checked: true },
            { type: 'check', id: 'a', checked: true },
        ])
        expect(ops).toEqual([
            { type: 'check', id: 'a', checked: false },
            { type: 'check', id: 'b', checked: true },
            { type: 'check', id: 'a', checked: true },
        ])
    })

    it('reads a stored queue defensively', () => {
        expect(parseQueue(null)).toEqual([])
        expect(parseQueue('not json')).toEqual([])
        expect(parseQueue(JSON.stringify([{ type: 'check', id: 'a', checked: true }, { type: 'nope' }, 4]))).toEqual([
            { type: 'check', id: 'a', checked: true },
        ])
    })
})

describe('grocery history', () => {
    it('remembers items without their amounts and counts repeats', () => {
        let history = remember([], ['2 cups whole milk', '3 limes'], 1)
        history = remember(history, ['1 cup whole milk'], 2)
        expect(history.map((p) => [p.label, p.count])).toEqual([
            ['whole milk', 2],
            ['limes', 1],
        ])
    })

    it('suggests what is not on the list, typed prefix first', () => {
        const history = remember([], ['lemons', 'whole milk', 'limes', 'milk chocolate'], 1)
        const onList = list(['2 limes'])
        expect(suggestions(history, onList, '').map((p) => p.label)).not.toContain('limes')
        expect(suggestions(history, onList, 'mil').map((p) => p.label)).toEqual(['milk chocolate', 'whole milk'])
        expect(suggestions(history, onList, 'lemons')).toEqual([])
    })

    it('reads stored history defensively', () => {
        expect(parseHistory('[{"label":"x"}]')).toEqual([])
        expect(parseHistory('{')).toEqual([])
    })
})

describe('grocery aisles', () => {
    it('walks the store in order with frozen last and keeps rows where they were added', () => {
        const items = list(['frozen peas', 'bread', '3 limes', 'milk'])
        items[2] = { ...(items[2] as GroceryItem), checked: true }
        const groups = groupByAisle(items)
        expect(groups.map((g) => g.category)).toEqual(['produce', 'bakery', 'dairy-eggs', 'frozen'])
        expect(AISLE_ORDER.at(-1)).toBe('frozen')
    })

    it('shares only what is left, by aisle', () => {
        const items = list(['frozen peas', 'bread', '3 limes'])
        items[0] = { ...(items[0] as GroceryItem), checked: true }
        expect(shareText(items)).toBe('Produce\n- 3 limes\n\nBakery\n- bread')
    })
})

describe('settings data copy', () => {
    it('says what an export holds', () => {
        expect(exportSummary(18, 4)).toBe('18 recipes, 4 collections and grocery list')
        expect(exportSummary(1, 0)).toBe('1 recipe and grocery list')
        expect(exportSummary(0, 0)).toBe('Recipes, collections and grocery list')
    })

    it('says what an import added', () => {
        const none = { recipesAdded: 0, recipesSkipped: 0, collectionsAdded: 0, groceryItemsAdded: 0 }
        expect(importedMessage({ ...none, recipesAdded: 3, collectionsAdded: 1 })).toBe(
            'Added 3 recipes and 1 collection',
        )
        expect(importedMessage({ ...none, recipesAdded: 1, recipesSkipped: 2 })).toBe('Added 1 recipe. 2 already here.')
        expect(importedMessage({ ...none, recipesSkipped: 5 })).toBe('Everything in that file is already here')
    })
})
