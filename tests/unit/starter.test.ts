import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalStore } from '@/server/db/local'
import { addStarterRecipes, STARTER_RECIPES } from '@/server/starter'

let dir: string
let store: LocalStore

beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'clipcook-starter-'))
    store = new LocalStore(dir)
})

afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
})

describe('addStarterRecipes', () => {
    it('adds the starter set with photos, newest first, and never twice', async () => {
        const added = await addStarterRecipes(store, 'cook-1', 1_000_000)
        expect(added.map((r) => r.title)).toEqual(STARTER_RECIPES.map((r) => r.title))
        for (const r of added) {
            expect(r.image).toMatch(/^data:image\/webp;base64,/)
            expect(r.seedColor).not.toBeNull()
            expect(r.sourceUrl).toBeNull()
            expect(r.totalMinutes).toBeGreaterThan(0)
        }
        expect(added[0]?.createdAt).toBeGreaterThan(added[1]?.createdAt ?? 0)

        // A second press (or a retry after a slow first one) adds nothing.
        expect(await addStarterRecipes(store, 'cook-1')).toEqual([])
        expect(await store.listRecipes('cook-1')).toHaveLength(STARTER_RECIPES.length)
        expect(await store.listRecipes('cook-2')).toHaveLength(0)
    }, 60_000)
})
