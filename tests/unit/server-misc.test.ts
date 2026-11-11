import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { signLocalSession, verifyLocalSession } from '@/server/auth'
import { CLIP_DRAFT_TTL_MS, loadClipDraft, saveClipDraft } from '@/server/clip-drafts'
import { exportStream, ImportError, importExport, parseExport } from '@/server/data-transfer'
import { LocalStore } from '@/server/db/local'
import { pickSeedColor } from '@/server/images'
import { decodeImageDataUrl, inlineImageUrl, inlineImageVersion } from '@/server/inline-images'
import { clientIp, rateLimit, resetRateLimits } from '@/server/rate-limit'

describe('local session cookie', () => {
    const secret = 's'.repeat(32)
    const now = 1_000_000

    it('round-trips and rejects tampering, other secrets, and expiry', () => {
        const value = signLocalSession(secret, { uid: 'demo', name: 'Demo', exp: now + 1000 })
        expect(verifyLocalSession(secret, value, now)?.uid).toBe('demo')
        expect(verifyLocalSession('t'.repeat(32), value, now)).toBeNull()
        expect(verifyLocalSession(secret, value, now + 1000)).toBeNull()
        const [v, body, sig] = value.split('.')
        const forged = Buffer.from(JSON.stringify({ uid: 'admin', name: null, exp: now + 1000 })).toString('base64url')
        expect(verifyLocalSession(secret, `${v}.${forged}.${sig}`, now)).toBeNull()
        expect(verifyLocalSession(secret, `${v}.${body}`, now)).toBeNull()
        expect(verifyLocalSession(secret, 'garbage', now)).toBeNull()
    })
})

describe('rate limiting', () => {
    beforeEach(() => resetRateLimits())

    it('allows the burst, refuses the next, and refills over time', () => {
        const policy = { capacity: 3, refillPerSecond: 1 }
        const t = 10_000
        expect([1, 2, 3].map(() => rateLimit(policy, 'k', t).ok)).toEqual([true, true, true])
        const denied = rateLimit(policy, 'k', t)
        expect(denied).toEqual({ ok: false, retryAfter: 1 })
        expect(rateLimit(policy, 'other', t).ok).toBe(true)
        expect(rateLimit(policy, 'k', t + 1000).ok).toBe(true)
    })

    it('keys named policies separately', () => {
        for (let i = 0; i < 10; i++) rateLimit('pairClaim', 'alice', 0)
        expect(rateLimit('pairClaim', 'alice', 0).ok).toBe(false)
        expect(rateLimit('clipUrl', 'alice', 0).ok).toBe(true)
    })

    it('reads the client IP from trusted hops only', () => {
        const h = (init: Record<string, string>) => new Headers(init)
        // A client-supplied first entry is ignored; the proxy-appended last one counts.
        expect(clientIp(h({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7' }), {})).toBe('203.0.113.7')
        expect(clientIp(h({ 'x-forwarded-for': '6.6.6.6, 198.51.100.1, 10.0.0.1' }), { TRUST_PROXY_HOPS: '2' })).toBe(
            '198.51.100.1',
        )
        expect(clientIp(h({ 'x-real-ip': '192.0.2.5', 'x-forwarded-for': '6.6.6.6' }), { VERCEL: '1' })).toBe(
            '192.0.2.5',
        )
        expect(clientIp(h({ 'x-forwarded-for': '2001:db8:1:2:3:4:5:6' }), {})).toBe('2001:db8:1:2::/64')
        expect(clientIp(h({ 'x-forwarded-for': '::ffff:192.0.2.9' }), {})).toBe('192.0.2.9')
        expect(clientIp(h({ 'x-forwarded-for': 'not-an-ip' }), {})).toBe('unknown')
        expect(clientIp(h({}), {})).toBe('unknown')
    })
})

describe('clip drafts', () => {
    let dir: string
    beforeEach(async () => {
        dir = await mkdtemp(path.join(os.tmpdir(), 'clipcook-drafts-'))
    })
    afterEach(async () => {
        await rm(dir, { recursive: true, force: true })
    })

    it('use 128-bit ids and expire after 15 minutes', async () => {
        const store = new LocalStore(dir)
        const now = Date.now()
        const id = await saveClipDraft(store, { title: 'Pie' }, now)
        expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/)
        expect(await loadClipDraft(store, id, now + 1000)).toEqual({ title: 'Pie' })
        expect(await loadClipDraft(store, id, now + CLIP_DRAFT_TTL_MS + 1)).toBeNull()
        expect(await loadClipDraft(store, '../../etc/passwd', now)).toBeNull()
    })
})

describe('export and import', () => {
    let dir: string
    let store: LocalStore
    beforeEach(async () => {
        dir = await mkdtemp(path.join(os.tmpdir(), 'clipcook-export-'))
        store = new LocalStore(dir)
    })
    afterEach(async () => {
        await rm(dir, { recursive: true, force: true })
    })

    async function seed() {
        await store.createCollection({ id: 'c1', uid: 'alice', name: 'Soups', createdAt: 1, updatedAt: 1 })
        const base = {
            uid: 'alice',
            description: '',
            servings: '',
            prepTime: '',
            cookTime: '',
            totalTime: '',
            totalMinutes: null,
            notes: '',
            image: '',
            thumbnail: '',
            seedColor: null,
            tags: ['soup'],
            favorite: true,
            cookCount: 2,
            lastCookedAt: null,
            createdAt: 5,
            updatedAt: 5,
            imagePath: null,
            thumbnailPath: null,
        }
        await store.createRecipe({
            ...base,
            id: 'r1',
            title: 'Leek Soup',
            ingredients: ['2 leeks'],
            instructions: ['Simmer.'],
            collectionIds: ['c1'],
            sourceUrl: 'https://soup.example/leek',
            sourceName: 'Soup Site',
        })
        await store.updateGroceryItems('alice', () => [
            {
                id: 'g1',
                text: '2 leeks',
                name: 'leek',
                quantity: 2,
                unit: null,
                category: 'produce',
                checked: false,
                recipeIds: ['r1'],
                addedAt: 1,
            },
        ])
    }

    async function exportText(uid: string) {
        return new Response(exportStream(store, uid, new Date(0))).text()
    }

    it('streams a versioned file that strips internal fields', async () => {
        await seed()
        const file = JSON.parse(await exportText('alice'))
        expect(file.schema).toBe('clipcook.export.v1')
        expect(file.recipes).toHaveLength(1)
        expect(file.recipes[0]).not.toHaveProperty('uid')
        expect(file.recipes[0]).not.toHaveProperty('imagePath')
        expect(file.collections).toEqual([{ id: 'c1', name: 'Soups', createdAt: 1 }])
        expect(file.grocery).toHaveLength(1)
    })

    it('imports into another account, remapping collections, then dedupes on a second run', async () => {
        await seed()
        const text = await exportText('alice')
        const first = await importExport(store, 'bob', parseExport(text))
        expect(first).toEqual({
            recipesAdded: 1,
            recipesSkipped: 0,
            collectionsAdded: 1,
            groceryItemsAdded: 1,
            planEntriesAdded: 0,
        })
        const [bobRecipe] = await store.listRecipes('bob')
        const [bobCollection] = await store.listCollections('bob')
        expect(bobRecipe?.id).not.toBe('r1')
        expect(bobRecipe?.collectionIds).toEqual([bobCollection?.id])
        expect(bobRecipe?.favorite).toBe(true)

        const second = await importExport(store, 'bob', parseExport(text))
        expect(second).toEqual({
            recipesAdded: 0,
            recipesSkipped: 1,
            collectionsAdded: 0,
            groceryItemsAdded: 0,
            planEntriesAdded: 0,
        })
        expect((await store.getRecipe('alice', 'r1'))?.title).toBe('Leek Soup')
    })

    it('skips by id when re-importing into the same account', async () => {
        await seed()
        const counts = await importExport(store, 'alice', parseExport(await exportText('alice')))
        expect(counts.recipesSkipped).toBe(1)
        expect(counts.recipesAdded).toBe(0)
    })

    it('rejects files that are not exports or are too big', () => {
        expect(() => parseExport('not json')).toThrow(ImportError)
        expect(() => parseExport(JSON.stringify({ schema: 'other', recipes: [] }))).toThrow(/not a ClipCook export/)
        const many = { schema: 'clipcook.export.v1', recipes: Array.from({ length: 2001 }, () => ({ title: 'x' })) }
        expect(() => parseExport(JSON.stringify(many))).toThrow(/2000/)
    })

    it('tolerates bad optional fields instead of failing the whole file', () => {
        const file = parseExport(
            JSON.stringify({
                schema: 'clipcook.export.v1',
                recipes: [{ title: 'Ok', servings: 4, sourceUrl: 'not a url', tags: 'oops', cookCount: -1 }],
            }),
        )
        expect(file.recipes[0]).toMatchObject({ servings: '4', sourceUrl: null, tags: [], cookCount: 0 })
    })
})

describe('pickSeedColor', () => {
    const argb = (hex: string) => (0xff000000 | Number.parseInt(hex.slice(1), 16)) >>> 0
    const hex = (value: number) => `#${(value & 0xffffff).toString(16).padStart(6, '0')}`

    it('prefers the food over a large dark, low-chroma pan', () => {
        const shakshuka = new Map([
            [argb('#3e434a'), 5200],
            [argb('#aea699'), 1500],
            [argb('#cf3c21'), 1800],
            [argb('#fafef4'), 600],
        ])
        expect(hex(pickSeedColor(shakshuka))).toBe('#cf3c21')
    })

    it('keeps the top scored color when it is already chromatic', () => {
        const curry = new Map([
            [argb('#c87a15'), 4000],
            [argb('#235254'), 1200],
        ])
        expect(hex(pickSeedColor(curry))).toBe('#c87a15')
    })

    it('falls back to the most common color for a gray photo, not a stock blue', () => {
        const gray = new Map([
            [argb('#808080'), 3000],
            [argb('#202020'), 1000],
        ])
        expect(hex(pickSeedColor(gray))).toBe('#808080')
    })
})

describe('inline image URLs', () => {
    const png = `data:image/png;base64,${Buffer.from('fake-bytes').toString('base64')}`

    it('swaps a data URL for a short versioned route and leaves hosted URLs alone', () => {
        const url = inlineImageUrl('abc_123', 'thumb', png)
        expect(url).toBe(`/api/images/abc_123/thumb?v=${inlineImageVersion(png)}`)
        expect(url.length).toBeLessThan(60)
        expect(inlineImageUrl('abc', 'thumb', 'https://example.com/a.webp')).toBe('https://example.com/a.webp')
        expect(inlineImageUrl('abc', 'thumb', '')).toBe('')
    })

    it('changes the version when the photo changes', () => {
        const other = `data:image/png;base64,${Buffer.from('other-bytes').toString('base64')}`
        expect(inlineImageVersion(png)).not.toBe(inlineImageVersion(other))
    })

    it('decodes only image data URLs', () => {
        expect(decodeImageDataUrl(png)?.type).toBe('image/png')
        expect(decodeImageDataUrl(png)?.bytes.toString()).toBe('fake-bytes')
        expect(decodeImageDataUrl('data:text/html;base64,PGI+')).toBeNull()
        expect(decodeImageDataUrl('https://example.com/x.png')).toBeNull()
    })
})
