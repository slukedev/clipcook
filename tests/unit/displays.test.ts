import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CODE_PATTERN, randomCode } from '@/server/crypto'
import { LocalStore } from '@/server/db/local'
import {
    authenticateDisplay,
    CAST_TOKEN_TTL_MS,
    claimCastToken,
    claimDisplayCode,
    clearDisplay,
    createCastToken,
    needsHeartbeat,
    PAIRING_TTL_MS,
    pollPairing,
    removeDisplay,
    renameDisplay,
    sendToDisplay,
    startPairing,
} from '@/server/displays'

let dir: string
let store: LocalStore
// Near the real clock: the local store prunes expired records against Date.now().
const T0 = Date.now()

beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'clipcook-displays-'))
    store = new LocalStore(dir)
})

afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
})

async function pairedDisplay(uid = 'alice') {
    const start = await startPairing(store, T0)
    const claim = await claimDisplayCode(store, uid, start.code, 'Kitchen', T0 + 1000)
    if (!claim.ok) throw new Error(claim.error)
    const poll = await pollPairing(store, start.pairingId, start.pollToken, T0 + 2000)
    if (poll.status !== 'claimed') throw new Error(poll.status)
    return { id: claim.display.id, cookie: poll.cookie }
}

describe('codes', () => {
    it('uses the unambiguous alphabet', () => {
        for (let i = 0; i < 200; i++) {
            const code = randomCode()
            expect(code).toMatch(CODE_PATTERN)
            expect(code).not.toMatch(/[01ILO]/)
        }
    })
})

describe('pairing lifecycle', () => {
    it('pending until claimed, then hands out a cookie exactly once', async () => {
        const start = await startPairing(store, T0)
        expect(start.expiresAt).toBe(T0 + PAIRING_TTL_MS)
        expect(await pollPairing(store, start.pairingId, start.pollToken, T0 + 500)).toEqual({ status: 'pending' })

        // Lowercase with a space, as someone might type it.
        const typed = `${start.code.slice(0, 3).toLowerCase()} ${start.code.slice(3)}`
        const claim = await claimDisplayCode(store, 'alice', typed, '  Kitchen  ', T0 + 1000)
        expect(claim).toMatchObject({ ok: true, display: { name: 'Kitchen', current: null } })

        const poll = await pollPairing(store, start.pairingId, start.pollToken, T0 + 2000)
        expect(poll.status).toBe('claimed')
        if (poll.status !== 'claimed') return
        const display = await authenticateDisplay(store, poll.cookie)
        expect(display?.uid).toBe('alice')

        expect(await pollPairing(store, start.pairingId, start.pollToken, T0 + 3000)).toEqual({ status: 'not_found' })
    })

    it('never stores the display token in the clear', async () => {
        const { id, cookie } = await pairedDisplay()
        const token = cookie.slice(cookie.indexOf('.') + 1)
        const raw = await store.getDisplay(id)
        expect(raw?.tokenHash).toBeTruthy()
        expect(JSON.stringify(raw)).not.toContain(token)
    })

    it('rejects a wrong poll token without consuming the pairing', async () => {
        const start = await startPairing(store, T0)
        await claimDisplayCode(store, 'alice', start.code, 'Kitchen', T0 + 1000)
        expect(await pollPairing(store, start.pairingId, 'x'.repeat(43), T0 + 2000)).toEqual({ status: 'not_found' })
        expect((await pollPairing(store, start.pairingId, start.pollToken, T0 + 2500)).status).toBe('claimed')
    })

    it('rejects wrong, malformed, expired, and already-claimed codes', async () => {
        const start = await startPairing(store, T0)
        const wrong = start.code === 'AAAAAA' ? 'BBBBBB' : 'AAAAAA'
        expect(await claimDisplayCode(store, 'alice', wrong, 'K', T0)).toEqual({ ok: false, error: 'invalid_code' })
        expect(await claimDisplayCode(store, 'alice', '12', 'K', T0)).toEqual({ ok: false, error: 'invalid_code' })
        expect(await claimDisplayCode(store, 'alice', 'OOOOOO', 'K', T0)).toEqual({ ok: false, error: 'invalid_code' })
        expect(await claimDisplayCode(store, 'alice', start.code, 'K', T0 + PAIRING_TTL_MS + 1)).toEqual({
            ok: false,
            error: 'invalid_code',
        })
        expect(await pollPairing(store, start.pairingId, start.pollToken, T0 + PAIRING_TTL_MS + 1)).toEqual({
            status: 'expired',
        })

        const fresh = await startPairing(store, T0)
        expect((await claimDisplayCode(store, 'alice', fresh.code, 'K', T0 + 10)).ok).toBe(true)
        expect(await claimDisplayCode(store, 'mallory', fresh.code, 'K', T0 + 20)).toEqual({
            ok: false,
            error: 'already_claimed',
        })
    })

    it('still delivers the cookie when the display polls after the code window closes', async () => {
        const start = await startPairing(store, T0)
        await claimDisplayCode(store, 'alice', start.code, 'K', T0 + PAIRING_TTL_MS - 1)
        expect((await pollPairing(store, start.pairingId, start.pollToken, T0 + PAIRING_TTL_MS + 5000)).status).toBe(
            'claimed',
        )
    })
})

describe('linked displays', () => {
    it('rejects forged, malformed, and cross-display cookies', async () => {
        const a = await pairedDisplay('alice')
        const b = await pairedDisplay('bob')
        const tokenA = a.cookie.slice(a.cookie.indexOf('.') + 1)
        expect(await authenticateDisplay(store, `${b.id}.${tokenA}`)).toBeNull()
        expect(await authenticateDisplay(store, `${a.id}.nope`)).toBeNull()
        expect(await authenticateDisplay(store, 'garbage')).toBeNull()
        expect(await authenticateDisplay(store, '')).toBeNull()
        expect((await authenticateDisplay(store, a.cookie))?.id).toBe(a.id)
    })

    it('send bumps the version only on change; owners only', async () => {
        const { id } = await pairedDisplay('alice')
        const v0 = (await store.getDisplay(id))?.version ?? 0
        const first = await sendToDisplay(store, 'alice', id, { recipeId: 'r1', step: 2, scale: 1 }, T0)
        expect(first.version).toBe(v0 + 1)
        expect(first.current).toEqual({ recipeId: 'r1', step: 2, scale: 1, sentAt: T0 })
        const same = await sendToDisplay(store, 'alice', id, { recipeId: 'r1', step: 2, scale: 1 }, T0 + 5)
        expect(same.version).toBe(v0 + 1)
        const next = await sendToDisplay(store, 'alice', id, { recipeId: 'r1', step: 3, scale: 1 }, T0 + 10)
        expect(next.version).toBe(v0 + 2)
        await expect(
            sendToDisplay(store, 'mallory', id, { recipeId: 'x', step: null, scale: 1 }),
        ).rejects.toMatchObject({
            code: 'NOT_FOUND',
        })
        expect((await clearDisplay(store, 'alice', id)).current).toBeNull()
        expect((await renameDisplay(store, 'alice', id, 'Island')).name).toBe('Island')
    })

    it('removing a display revokes its cookie immediately', async () => {
        const { id, cookie } = await pairedDisplay('alice')
        await expect(removeDisplay(store, 'mallory', id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
        expect(await authenticateDisplay(store, cookie)).not.toBeNull()
        await removeDisplay(store, 'alice', id)
        expect(await authenticateDisplay(store, cookie)).toBeNull()
    })

    it('throttles heartbeats to once a minute', async () => {
        const { id } = await pairedDisplay()
        const d = await store.getDisplay(id)
        if (!d) throw new Error('missing')
        expect(needsHeartbeat(d, T0)).toBe(true)
        await store.touchDisplay(id, T0)
        const touched = await store.getDisplay(id)
        if (!touched) throw new Error('missing')
        expect(needsHeartbeat(touched, T0 + 59_000)).toBe(false)
        expect(needsHeartbeat(touched, T0 + 60_000)).toBe(true)
    })
})

describe('cast tokens', () => {
    it('are single use, expire, and reuse the display for the same device', async () => {
        const { token } = await createCastToken(store, 'alice', T0)
        const first = await claimCastToken(store, token, 'device-1234', null, T0 + 1000)
        expect(first).not.toBeNull()
        expect(await claimCastToken(store, token, 'device-1234', null, T0 + 1000)).toBeNull()

        const again = await createCastToken(store, 'alice', T0)
        const second = await claimCastToken(store, again.token, 'device-1234', null, T0 + 2000)
        expect(second?.displayId).toBe(first?.displayId)
        // The old cookie stops working once the device re-casts.
        expect(await authenticateDisplay(store, first?.cookie)).toBeNull()
        expect((await authenticateDisplay(store, second?.cookie))?.name).toBe('Chromecast')

        const late = await createCastToken(store, 'alice', T0)
        expect(await claimCastToken(store, late.token, null, null, T0 + CAST_TOKEN_TTL_MS + 1)).toBeNull()
    })
})
