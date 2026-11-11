import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveBackend } from '@/server/db'
import { LocalStore } from '@/server/db/local'
import { recipeFromData } from '@/server/db/normalize'
import type { DisplayRecord, RecipeRecord } from '@/server/db/types'
import { StoreError } from '@/server/db/types'

let dir: string
let store: LocalStore

beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'clipcook-store-'))
    store = new LocalStore(dir)
})

afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
})

function recipe(uid: string, overrides: Partial<RecipeRecord> = {}): RecipeRecord {
    const id = overrides.id ?? store.newId()
    return {
        id,
        uid,
        title: 'Soup',
        description: '',
        servings: '4',
        prepTime: '',
        cookTime: '',
        totalTime: '30 min',
        totalMinutes: 30,
        ingredients: ['1 onion'],
        instructions: ['Cook.'],
        notes: '',
        image: '',
        thumbnail: '',
        seedColor: null,
        tags: [],
        collectionIds: [],
        favorite: false,
        sourceUrl: null,
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

describe('LocalStore recipes', () => {
    it('creates, lists newest first, reads, updates, and deletes', async () => {
        await store.createRecipe(recipe('alice', { id: 'a1', title: 'Older', createdAt: 1 }))
        await store.createRecipe(recipe('alice', { id: 'a2', title: 'Newer', createdAt: 2 }))
        expect((await store.listRecipeSummaries('alice')).map((r) => r.id)).toEqual(['a2', 'a1'])

        const updated = await store.updateRecipe('alice', 'a1', (r) => ({ title: `${r.title}!`, favorite: true }))
        expect(updated).toMatchObject({ title: 'Older!', favorite: true, uid: 'alice' })
        expect((await store.getRecipe('alice', 'a1'))?.title).toBe('Older!')

        await store.deleteRecipe('alice', 'a1')
        expect(await store.getRecipe('alice', 'a1')).toBeNull()
    })

    it('treats other users records as missing for every operation', async () => {
        await store.createRecipe(recipe('alice', { id: 'secret' }))
        expect(await store.getRecipe('mallory', 'secret')).toBeNull()
        expect(await store.listRecipeSummaries('mallory')).toEqual([])
        await expect(store.updateRecipe('mallory', 'secret', () => ({ title: 'pwned' }))).rejects.toMatchObject({
            code: 'NOT_FOUND',
        })
        await expect(store.deleteRecipe('mallory', 'secret')).rejects.toBeInstanceOf(StoreError)
        expect((await store.getRecipe('alice', 'secret'))?.title).toBe('Soup')
    })

    it('cannot change id or owner through a patch', async () => {
        await store.createRecipe(recipe('alice', { id: 'r1' }))
        await store.updateRecipe('alice', 'r1', () => ({ uid: 'mallory', id: 'other' }))
        expect(await store.getRecipe('alice', 'r1')).not.toBeNull()
        expect(await store.getRecipe('mallory', 'other')).toBeNull()
    })

    it('rejects duplicate ids and rolls back a mutation that throws', async () => {
        await store.createRecipe(recipe('alice', { id: 'r1' }))
        await expect(store.createRecipe(recipe('bob', { id: 'r1' }))).rejects.toMatchObject({ code: 'CONFLICT' })
        await expect(
            store.updateRecipe('alice', 'r1', () => {
                throw new Error('boom')
            }),
        ).rejects.toThrow('boom')
        expect((await store.getRecipe('alice', 'r1'))?.title).toBe('Soup')
    })

    it('serializes concurrent writes without losing any', async () => {
        await store.createRecipe(recipe('alice', { id: 'r1' }))
        await Promise.all(
            Array.from({ length: 25 }, () =>
                store.updateRecipe('alice', 'r1', (r) => ({ cookCount: r.cookCount + 1 })),
            ),
        )
        expect((await store.getRecipe('alice', 'r1'))?.cookCount).toBe(25)
    })

    it('persists atomically and is readable by a fresh instance (another process)', async () => {
        await store.createRecipe(recipe('alice', { id: 'r1', title: 'Persisted' }))
        const files = await readdir(dir)
        expect(files.filter((f) => f.endsWith('.tmp'))).toEqual([])
        const raw = JSON.parse(await readFile(path.join(dir, 'clipcook.json'), 'utf8'))
        expect(raw.recipes.r1.title).toBe('Persisted')
        const other = new LocalStore(dir)
        expect((await other.getRecipe('alice', 'r1'))?.title).toBe('Persisted')
        await other.updateRecipe('alice', 'r1', () => ({ title: 'Changed elsewhere' }))
        expect((await store.getRecipe('alice', 'r1'))?.title).toBe('Changed elsewhere')
    })
})

describe('LocalStore collections and grocery', () => {
    it('membership only touches owned recipes and deleting a collection strips it from recipes', async () => {
        await store.createRecipe(recipe('alice', { id: 'mine' }))
        await store.createRecipe(recipe('bob', { id: 'theirs' }))
        await store.createCollection({ id: 'c1', uid: 'alice', name: 'Weeknight', createdAt: 1, updatedAt: 1 })
        expect(await store.setCollectionMembership('alice', 'c1', ['mine', 'theirs', 'missing', 'mine'], true)).toBe(1)
        expect((await store.getRecipe('alice', 'mine'))?.collectionIds).toEqual(['c1'])
        expect((await store.getRecipe('bob', 'theirs'))?.collectionIds).toEqual([])
        await expect(store.setCollectionMembership('bob', 'c1', ['theirs'], true)).rejects.toMatchObject({
            code: 'NOT_FOUND',
        })
        await store.deleteCollection('alice', 'c1')
        expect((await store.getRecipe('alice', 'mine'))?.collectionIds).toEqual([])
        expect(await store.listCollections('alice')).toEqual([])
    })

    it('keeps grocery lists per user', async () => {
        await store.updateGroceryItems('alice', () => [
            {
                id: 'g1',
                text: 'milk',
                name: 'milk',
                quantity: null,
                unit: null,
                category: 'dairy-eggs',
                checked: false,
                recipeIds: [],
                addedAt: 1,
            },
        ])
        expect(await store.getGroceryItems('alice')).toHaveLength(1)
        expect(await store.getGroceryItems('bob')).toEqual([])
    })
})

describe('legacy documents', () => {
    it('reads old allRecipes docs with defaults for new fields', () => {
        const r = recipeFromData('old', {
            uid: 'alice',
            title: 'Old',
            servings: 4,
            prepTime: '10 minutes',
            cookTime: '1 hour',
            ingredients: ['a', 2],
            image: 'data:image/jpeg;base64,AAA',
            thumbnail: 'data:image/jpeg;base64,BBB',
            createdAt: { toMillis: () => 1234 },
        })
        expect(r).toMatchObject({
            servings: '4',
            ingredients: ['a', '2'],
            totalMinutes: 70,
            tags: [],
            favorite: false,
            sourceUrl: null,
            cookCount: 0,
            createdAt: 1234,
            updatedAt: 1234,
            imagePath: null,
        })
    })

    it('prefers Storage URLs over inline fields', () => {
        const r = recipeFromData('new', {
            uid: 'u',
            image: '',
            imageUrl: 'https://firebasestorage.googleapis.com/x',
            thumbnailUrl: 'https://firebasestorage.googleapis.com/t',
            imagePath: 'users/u/recipes/new/image.webp',
        })
        expect(r.image).toBe('https://firebasestorage.googleapis.com/x')
        expect(r.thumbnail).toBe('https://firebasestorage.googleapis.com/t')
        expect(r.imagePath).toBe('users/u/recipes/new/image.webp')
    })
})

describe('resolveBackend', () => {
    it('honors the explicit setting, falls back by environment, and refuses an unconfigured production', () => {
        expect(resolveBackend({ CLIPCOOK_BACKEND: 'local', NODE_ENV: 'production' })).toBe('local')
        expect(
            resolveBackend({
                FIREBASE_ADMIN_PROJECT_ID: 'p',
                FIREBASE_ADMIN_CLIENT_EMAIL: 'e',
                FIREBASE_ADMIN_PRIVATE_KEY: 'k',
                NODE_ENV: 'production',
            }),
        ).toBe('firebase')
        expect(resolveBackend({ NODE_ENV: 'development' })).toBe('local')
        expect(() => resolveBackend({ NODE_ENV: 'production' })).toThrow(/No backend configured/)
        expect(() => resolveBackend({ CLIPCOOK_BACKEND: 'mongo' })).toThrow()
    })
})

describe('LocalStore writes', () => {
    const stampOf = async () => {
        const { stat } = await import('node:fs/promises')
        const st = await stat(path.join(dir, 'clipcook.json'))
        return `${st.mtimeMs}:${st.size}:${st.ino}`
    }

    it('leaves the file alone when a pairing poll changes nothing, and saves when it claims', async () => {
        const now = Date.now()
        await store.createPairing({
            id: 'p1',
            code: 'ABC123',
            pollTokenHash: 'poll',
            createdAt: now,
            expiresAt: now + 60_000,
            claimedBy: null,
        })
        const before = await stampOf()
        expect(await store.collectPairing('p1', 'poll', 'display', now)).toEqual({ status: 'pending' })
        expect(await store.collectPairing('p1', 'wrong', 'display', now)).toEqual({ status: 'not_found' })
        expect(await store.collectPairing('nope', 'poll', 'display', now)).toEqual({ status: 'not_found' })
        expect(await store.consumeCastToken('missing', now)).toBeNull()
        await store.touchDisplay('missing', now)
        expect(await stampOf()).toBe(before)

        const display: DisplayRecord = {
            id: 'd1',
            uid: 'alice',
            name: 'Kitchen',
            tokenHash: null,
            createdAt: now,
            lastSeenAt: null,
            current: null,
            version: 0,
            castDeviceId: null,
        }
        expect(await store.claimPairing('p1', display, now)).toBe('ok')
        const claimed = await stampOf()
        expect(await store.collectPairing('p1', 'poll', 'display', now)).toEqual({ status: 'claimed', displayId: 'd1' })
        expect(await stampOf()).not.toBe(claimed)
        expect((await store.getDisplay('d1'))?.tokenHash).toBe('display')
        expect(await store.getPairing('p1')).toBeNull()
    })

    it('still saves when only expired records were pruned', async () => {
        await store.createCastToken({ id: 't1', uid: 'alice', expiresAt: Date.now() + 20 })
        const before = await stampOf()
        await new Promise((r) => setTimeout(r, 40))
        expect(await store.consumeCastToken('missing', Date.now())).toBeNull()
        expect(await stampOf()).not.toBe(before)
    })
})
