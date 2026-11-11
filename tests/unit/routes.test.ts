import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Route handlers resolve the store from the environment, so point it at a temp dir first.
let dir: string
type Routes = {
    clip: typeof import('@/app/api/clip/route')
    pair: typeof import('@/app/api/display/pair/route')
    status: typeof import('@/app/api/display/pair/status/route')
    state: typeof import('@/app/api/display/state/route')
    recipe: typeof import('@/app/api/display/recipe/[id]/route')
    session: typeof import('@/app/api/display/session/route')
    displays: typeof import('@/server/displays')
    db: typeof import('@/server/db')
}
let r: Routes

beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'clipcook-routes-'))
    process.env.CLIPCOOK_BACKEND = 'local'
    process.env.CLIPCOOK_DATA_DIR = dir
    process.env.APP_URL = 'https://clipcook.test'
    r = {
        clip: await import('@/app/api/clip/route'),
        pair: await import('@/app/api/display/pair/route'),
        status: await import('@/app/api/display/pair/status/route'),
        state: await import('@/app/api/display/state/route'),
        recipe: await import('@/app/api/display/recipe/[id]/route'),
        session: await import('@/app/api/display/session/route'),
        displays: await import('@/server/displays'),
        db: await import('@/server/db'),
    }
})

afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
})

const LD = JSON.stringify({
    '@type': 'Recipe',
    name: 'Route Cake',
    recipeIngredient: ['1 cup flour', '2 eggs'],
    recipeInstructions: 'Bake 30 minutes.',
})

function req(url: string, init: ConstructorParameters<typeof NextRequest>[1] = {}) {
    return new NextRequest(new URL(url, 'https://clipcook.test'), init)
}

describe('POST /api/clip', () => {
    it('parks a multipart bookmarklet post as a draft and 303s to /clip?draft=', async () => {
        const form = new FormData()
        form.set('url', 'https://cake.example/c')
        form.set('title', 'Cake tab')
        form.append('jsonld', LD)
        form.set('html', '<meta property="og:site_name" content="Cake Co">')
        const res = await r.clip.POST(
            req('/api/clip?url=https%3A%2F%2Fcake.example%2Fc', { method: 'POST', body: form }),
        )
        expect(res.status).toBe(303)
        const location = new URL(res.headers.get('location') ?? '')
        expect(location.origin).toBe('https://clipcook.test')
        expect(location.pathname).toBe('/clip')
        const draftId = location.searchParams.get('draft') ?? ''
        const { loadClipDraft } = await import('@/server/clip-drafts')
        const draft = await loadClipDraft(await r.db.getStore(), draftId)
        expect(draft).toMatchObject({ title: 'Route Cake', sourceName: 'Cake Co', instructions: ['Bake 30 minutes.'] })
    })

    it('answers JSON clients with the draft location', async () => {
        const res = await r.clip.POST(
            req('/api/clip', {
                method: 'POST',
                headers: { 'content-type': 'application/json', accept: 'application/json' },
                body: JSON.stringify({ url: 'https://cake.example/c', jsonld: [LD] }),
            }),
        )
        expect(res.status).toBe(200)
        expect((await res.json()).location).toMatch(/^https:\/\/clipcook\.test\/clip\?draft=/)
    })

    it('falls back to a server-side clip when the page had no recipe or the body is too big', async () => {
        const empty = new FormData()
        empty.set('url', 'https://cake.example/c')
        empty.set('html', '<p>nothing</p>')
        const res = await r.clip.POST(
            req('/api/clip?url=https%3A%2F%2Fcake.example%2Fc', { method: 'POST', body: empty }),
        )
        expect(res.status).toBe(303)
        expect(res.headers.get('location')).toBe('https://clipcook.test/clip?url=https%3A%2F%2Fcake.example%2Fc')

        const big = new FormData()
        big.set('html', 'a'.repeat(1_100_000))
        const tooBig = await r.clip.POST(
            req('/api/clip?url=https%3A%2F%2Fcake.example%2Fc', { method: 'POST', body: big }),
        )
        expect(tooBig.status).toBe(303)
        expect(tooBig.headers.get('location')).toContain('/clip?url=')
    })

    it('never redirects to a non-http fallback', async () => {
        const res = await r.clip.POST(
            req('/api/clip?url=javascript%3Aalert(1)', { method: 'POST', body: new FormData() }),
        )
        expect(res.headers.get('location')).toBe('https://clipcook.test/clip')
    })
})

describe('display endpoints', () => {
    it('pairs, polls, sets the cookie, serves state with ETags, and revokes', async () => {
        const pairRes = await r.pair.POST(req('/api/display/pair', { method: 'POST' }))
        const pairing = await pairRes.json()
        expect(pairing.linkUrl).toBe(`https://clipcook.test/link?code=${pairing.code}`)
        expect(pairing.qrSvg).toMatch(/^<svg role="img"/)

        const poll = () =>
            r.status.GET(req(`/api/display/pair/status?pairingId=${pairing.pairingId}&pollToken=${pairing.pollToken}`))
        expect(await (await poll()).json()).toEqual({ status: 'pending' })

        const store = await r.db.getStore()
        const claim = await r.displays.claimDisplayCode(store, 'alice', pairing.code, 'Kitchen')
        expect(claim.ok).toBe(true)

        const claimed = await poll()
        expect(claimed.status).toBe(200)
        const setCookie = claimed.headers.get('set-cookie') ?? ''
        expect(setCookie).toMatch(/clipcook_display=/)
        expect(setCookie).toMatch(/HttpOnly/i)
        expect(setCookie).toMatch(/SameSite=lax/i)
        expect(setCookie).toMatch(/Max-Age=31536000/)
        const cookie = /clipcook_display=([^;]+)/.exec(setCookie)?.[1] ?? ''

        const state = await r.state.GET(
            req('/api/display/state', { headers: { cookie: `clipcook_display=${cookie}` } }),
        )
        expect(state.status).toBe(200)
        const etag = state.headers.get('etag') ?? ''
        expect(await state.json()).toMatchObject({ name: 'Kitchen', current: null })
        const notModified = await r.state.GET(
            req('/api/display/state', { headers: { cookie: `clipcook_display=${cookie}`, 'if-none-match': etag } }),
        )
        expect(notModified.status).toBe(304)

        if (!claim.ok) return
        await store.createRecipe({
            id: 'rcp1',
            uid: 'alice',
            title: 'Shown',
            description: '',
            servings: '',
            prepTime: '',
            cookTime: '',
            totalTime: '',
            totalMinutes: null,
            ingredients: [],
            instructions: ['Step'],
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
        })
        await r.displays.sendToDisplay(store, 'alice', claim.display.id, { recipeId: 'rcp1', step: 0, scale: 1 })
        const changed = await r.state.GET(
            req('/api/display/state', { headers: { cookie: `clipcook_display=${cookie}`, 'if-none-match': etag } }),
        )
        expect(changed.status).toBe(200)
        expect((await changed.json()).current).toMatchObject({ recipeId: 'rcp1', step: 0 })

        const recipe = await r.recipe.GET(
            req('/api/display/recipe/rcp1', { headers: { cookie: `clipcook_display=${cookie}` } }),
            {
                params: Promise.resolve({ id: 'rcp1' }),
            },
        )
        const body = await recipe.text()
        expect(JSON.parse(body).title).toBe('Shown')
        expect(body).not.toContain('alice')

        await r.session.DELETE(
            req('/api/display/session', { method: 'DELETE', headers: { cookie: `clipcook_display=${cookie}` } }),
        )
        const revoked = await r.state.GET(
            req('/api/display/state', { headers: { cookie: `clipcook_display=${cookie}` } }),
        )
        expect(revoked.status).toBe(401)
        expect(revoked.headers.get('set-cookie')).toMatch(/clipcook_display=;/)
    })

    it('rejects malformed poll parameters without touching the store', async () => {
        const res = await r.status.GET(req('/api/display/pair/status?pairingId=..%2F&pollToken=x'))
        expect(res.status).toBe(404)
    })
})
