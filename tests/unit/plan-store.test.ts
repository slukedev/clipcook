import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LIMITS, type PlanEntry } from '@/lib/domain/types'
import { todayIn } from '@/lib/plan/week'
import { exportStream, importExport, parseExport } from '@/server/data-transfer'
import { LocalStore } from '@/server/db/local'
import type { RecipeRecord } from '@/server/db/types'
import { StoreError } from '@/server/db/types'
import { deleteRecipe } from '@/server/recipes'

let dir: string
let store: LocalStore
const today = todayIn('UTC')

beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'clipcook-plan-'))
    store = new LocalStore(dir)
})

afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
})

function entry(overrides: Partial<PlanEntry> = {}): PlanEntry {
    return {
        id: overrides.id ?? store.newId(),
        date: today,
        meal: 'dinner',
        recipeId: 'r1',
        note: '',
        servings: null,
        groceryAddedAt: null,
        createdAt: 1,
        ...overrides,
    }
}

function recipe(uid: string, overrides: Partial<RecipeRecord> = {}): RecipeRecord {
    return {
        id: 'r1',
        uid,
        title: 'Leek Soup',
        description: '',
        servings: '4',
        prepTime: '',
        cookTime: '',
        totalTime: '',
        totalMinutes: null,
        ingredients: ['2 leeks'],
        instructions: ['Simmer.'],
        notes: '',
        image: '',
        thumbnail: '',
        seedColor: null,
        tags: [],
        collectionIds: [],
        favorite: false,
        sourceUrl: 'https://soup.example/leek',
        sourceName: null,
        cookCount: 0,
        lastCookedAt: null,
        createdAt: 1,
        updatedAt: 1,
        imagePath: null,
        thumbnailPath: null,
        ...overrides,
    }
}

describe('LocalStore meal plan', () => {
    it('loads a data file written before plans existed', async () => {
        await writeFile(path.join(dir, 'clipcook.json'), JSON.stringify({ version: 1, recipes: {}, grocery: {} }))
        expect(await store.getPlanEntries('alice')).toEqual([])
        await store.updatePlanEntries('alice', () => [entry({ id: 'a' })])
        expect((await store.getPlanEntries('alice')).map((e) => e.id)).toEqual(['a'])
    })

    it('keeps each cook to their own plan', async () => {
        await store.updatePlanEntries('alice', () => [entry({ id: 'a' })])
        expect(await store.getPlanEntries('bob')).toEqual([])
    })

    it('throws a LIMIT error with a sentence to show, and saves nothing', async () => {
        const full = Array.from({ length: LIMITS.planEntries }, (_, i) => entry({ id: `e${i}` }))
        await store.updatePlanEntries('alice', () => full)
        const attempt = store.updatePlanEntries('alice', (current) => [...current, entry({ id: 'extra' })])
        await expect(attempt).rejects.toBeInstanceOf(StoreError)
        await expect(attempt).rejects.toMatchObject({ code: 'LIMIT', message: expect.stringMatching(/full/) })
        expect(await store.getPlanEntries('alice')).toHaveLength(LIMITS.planEntries)
    })

    it('normalizes a damaged file instead of failing', async () => {
        await writeFile(
            path.join(dir, 'clipcook.json'),
            JSON.stringify({ version: 1, plans: { alice: [{ id: 'ok', date: today, recipeId: 'r1' }, 'junk', {}] } }),
        )
        expect((await store.getPlanEntries('alice')).map((e) => e.id)).toEqual(['ok'])
    })

    it('drops a deleted recipe from the plan and keeps notes', async () => {
        await store.createRecipe(recipe('alice'))
        await store.updatePlanEntries('alice', () => [
            entry({ id: 'a' }),
            entry({ id: 'n', recipeId: null, note: 'Leftovers' }),
        ])
        await deleteRecipe(store, 'alice', 'r1')
        expect((await store.getPlanEntries('alice')).map((e) => e.id)).toEqual(['n'])
    })
})

describe('plan export and import', () => {
    async function exportText(uid: string) {
        return new Response(exportStream(store, uid, new Date(0))).text()
    }

    it('exports the plan without ids or shopping state', async () => {
        await store.createRecipe(recipe('alice'))
        await store.updatePlanEntries('alice', () => [entry({ id: 'a', servings: 6, groceryAddedAt: 5 })])
        const file = JSON.parse(await exportText('alice'))
        expect(file.plan).toEqual([{ date: today, meal: 'dinner', recipeId: 'r1', note: '', servings: 6 }])
    })

    it('remaps recipe ids into another account, keeps notes, and dedupes a second run', async () => {
        await store.createRecipe(recipe('alice'))
        await store.updatePlanEntries('alice', () => [
            entry({ id: 'a', servings: 2 }),
            entry({ id: 'n', recipeId: null, note: 'Eat out', meal: 'lunch' }),
            entry({ id: 'x', recipeId: 'not-exported' }),
        ])
        const text = await exportText('alice')
        const first = await importExport(store, 'bob', parseExport(text))
        // The orphan entry pointed at a recipe that is not in the file, so it is left out.
        expect(first.planEntriesAdded).toBe(2)
        const [bobRecipe] = await store.listRecipes('bob')
        const plan = await store.getPlanEntries('bob')
        expect(plan.map((e) => [e.meal, e.recipeId, e.note, e.servings])).toEqual([
            ['lunch', null, 'Eat out', null],
            ['dinner', bobRecipe?.id, '', 2],
        ])

        const second = await importExport(store, 'bob', parseExport(text))
        expect(second.planEntriesAdded).toBe(0)
        expect(await store.getPlanEntries('bob')).toHaveLength(2)
    })

    it('maps an entry onto a recipe the account already has', async () => {
        await store.createRecipe(recipe('alice'))
        await store.updatePlanEntries('alice', () => [entry({ id: 'a' })])
        const text = await exportText('alice')
        await store.createRecipe(recipe('bob', { id: 'bobs-soup' }))
        await importExport(store, 'bob', parseExport(text))
        expect((await store.getPlanEntries('bob')).map((e) => e.recipeId)).toEqual(['bobs-soup'])
    })

    it('reads an export from before plans existed, and skips a damaged plan', async () => {
        const old = { schema: 'clipcook.export.v1', recipes: [{ title: 'Ok' }] }
        expect(parseExport(JSON.stringify(old)).plan).toEqual([])
        expect(parseExport(JSON.stringify({ ...old, plan: 'nope' })).plan).toEqual([])
        const counts = await importExport(store, 'bob', parseExport(JSON.stringify(old)))
        expect(counts.planEntriesAdded).toBe(0)
        expect(JSON.parse(await readFile(path.join(dir, 'clipcook.json'), 'utf8')).plans ?? {}).toEqual({})
    })
})
