import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LIMITS } from '@/lib/domain/types'
import { CODE_PATTERN, randomCode } from '@/server/crypto'
import { LocalStore } from '@/server/db/local'
import {
    authenticateDisplay,
    CAST_TOKEN_TTL_MS,
    claimCastToken,
    claimDisplayCode,
    clearDisplay,
    createCastToken,
    DISPLAY_OFFLINE_AFTER_MS,
    displayPresence,
    needsHeartbeat,
    PAIRING_TTL_MS,
    pollPairing,
    removeDisplay,
    renameDisplay,
    sendToDisplay,
    startPairing,
    uniqueDisplayName,
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

describe('re-pairing the same device', () => {
    const DEVICE = '6f1c2a9e-3b4d-4e5f-8a7b-0c1d2e3f4a5b'

    async function pairDevice(name: string | null, at: number, deviceId: string | null = DEVICE, uid = 'alice') {
        const start = await startPairing(store, at, deviceId)
        const claim = await claimDisplayCode(store, uid, start.code, name, at + 100)
        if (!claim.ok) throw new Error(claim.error)
        return { start, claim: claim.display }
    }

    it('reuses the entry for a device that lost its cookie and keeps its name', async () => {
        const first = await pairDevice('Counter', T0)
        await pollPairing(store, first.start.pairingId, first.start.pollToken, T0 + 200)
        await sendToDisplay(store, 'alice', first.claim.id, { recipeId: 'r1', step: 2, scale: 1 }, T0 + 300)

        const again = await pairDevice(null, T0 + 1000)
        expect(again.claim.id).toBe(first.claim.id)
        expect(again.claim.name).toBe('Counter')
        const poll = await pollPairing(store, again.start.pairingId, again.start.pollToken, T0 + 1200)
        if (poll.status !== 'claimed') throw new Error(poll.status)

        const all = await store.listDisplays('alice')
        expect(all).toHaveLength(1)
        expect(all[0]?.current).toMatchObject({ recipeId: 'r1', step: 2 })
        expect((await authenticateDisplay(store, poll.cookie))?.id).toBe(first.claim.id)
    })

    it('takes a newly typed name when re-pairing', async () => {
        await pairDevice('Counter', T0)
        await pairDevice('Island', T0 + 1000, DEVICE)
        await pairDevice('Fridge', T0 + 2000, 'another-device-0001')
        expect((await store.listDisplays('alice')).map((d) => d.name).sort()).toEqual(['Fridge', 'Island'])
    })

    it('typing a name another display uses still gets a number', async () => {
        await pairDevice('Fridge', T0, 'another-device-0001')
        await pairDevice('Counter', T0 + 100)
        const again = await pairDevice('fridge', T0 + 1000)
        expect(again.claim.name).toBe('fridge 2')
    })

    it('reusing an entry does not count against the display limit', async () => {
        await pairDevice('Mine', T0)
        for (let i = 0; i < LIMITS.displays - 1; i++) await pairDevice(`D${i}`, T0 + 10 + i, `other-device-${i}000`)
        expect(await store.listDisplays('alice')).toHaveLength(LIMITS.displays)
        const again = await pairDevice(null, T0 + 1000)
        expect(again.claim.name).toBe('Mine')
        const extra = await startPairing(store, T0 + 2000, 'brand-new-device')
        expect(await claimDisplayCode(store, 'alice', extra.code, null, T0 + 2100)).toEqual({
            ok: false,
            error: 'too_many_displays',
        })
    })

    it('a device paired by another cook gets its own entry there', async () => {
        await pairDevice('Kitchen', T0)
        const bob = await pairDevice(null, T0 + 1000, DEVICE, 'bob')
        expect(bob.claim.name).toBe('Kitchen')
        expect(await store.listDisplays('alice')).toHaveLength(1)
        expect(await store.listDisplays('bob')).toHaveLength(1)
    })

    it('clients without a device id always get a new entry', async () => {
        await pairDevice(null, T0, null)
        await pairDevice(null, T0 + 1000, null)
        expect((await store.listDisplays('alice')).map((d) => d.name).sort()).toEqual(['Kitchen', 'Kitchen 2'])
    })

    it('a valid cookie for another entry of the same device is retired on collection', async () => {
        const first = await pairDevice('Old', T0)
        const firstPoll = await pollPairing(store, first.start.pairingId, first.start.pollToken, T0 + 200)
        if (firstPoll.status !== 'claimed') throw new Error(firstPoll.status)
        const previous = await authenticateDisplay(store, firstPoll.cookie)

        // Paired again under another account while the browser still holds the old cookie.
        const bob = await pairDevice(null, T0 + 1000, DEVICE, 'bob')
        const poll = await pollPairing(store, bob.start.pairingId, bob.start.pollToken, T0 + 1200, async () => previous)
        expect(poll.status).toBe('claimed')
        expect(await store.listDisplays('alice')).toHaveLength(0)
        expect(await authenticateDisplay(store, firstPoll.cookie)).toBeNull()
        expect(await store.listDisplays('bob')).toHaveLength(1)
    })

    it('keeps the entry when the cookie belongs to the very entry being re-paired', async () => {
        const first = await pairDevice('Kitchen', T0)
        const firstPoll = await pollPairing(store, first.start.pairingId, first.start.pollToken, T0 + 200)
        if (firstPoll.status !== 'claimed') throw new Error(firstPoll.status)
        const previous = await authenticateDisplay(store, firstPoll.cookie)
        const again = await pairDevice(null, T0 + 1000)
        await pollPairing(store, again.start.pairingId, again.start.pollToken, T0 + 1200, async () => previous)
        expect((await store.listDisplays('alice')).map((d) => d.id)).toEqual([first.claim.id])
    })

    it('leaves a cookie for a different device alone', async () => {
        const other = await pairDevice('Fridge', T0, 'another-device-0001')
        const otherPoll = await pollPairing(store, other.start.pairingId, other.start.pollToken, T0 + 200)
        if (otherPoll.status !== 'claimed') throw new Error(otherPoll.status)
        const previous = await authenticateDisplay(store, otherPoll.cookie)
        const mine = await pairDevice('Counter', T0 + 1000)
        await pollPairing(store, mine.start.pairingId, mine.start.pollToken, T0 + 1200, async () => previous)
        expect(await store.listDisplays('alice')).toHaveLength(2)
    })

    it('drops displays that were claimed but never collected within the pairing window', async () => {
        const stale = await pairDevice('Never', Date.now() - PAIRING_TTL_MS - 5000, 'stale-device-0001')
        const live = await pairDevice('Fresh', Date.now(), 'fresh-device-0001')
        const ids = (await store.listDisplays('alice')).map((d) => d.id)
        expect(ids).toEqual([live.claim.id])
        // The next write removes it from storage for good.
        await store.touchDisplay(live.claim.id, Date.now())
        expect(await store.getDisplay(stale.claim.id)).toBeNull()
        // Once collected, age no longer matters; the uncollected one ages out.
        const linked = await pairDevice('Linked', Date.now(), 'linked-device-0001')
        await pollPairing(store, linked.start.pairingId, linked.start.pollToken, Date.now())
        const later = Date.now() + PAIRING_TTL_MS + 5000
        expect((await store.listDisplays('alice', later)).map((d) => d.name)).toEqual(['Linked'])
    })

    it('re-pairing an entry that never linked restarts its collection window', async () => {
        const first = await pairDevice('Kitchen', Date.now() - PAIRING_TTL_MS + 1000)
        const again = await pairDevice(null, Date.now())
        expect(again.claim.id).toBe(first.claim.id)
        expect(await store.listDisplays('alice', Date.now() + 5000)).toHaveLength(1)
    })
})

describe('display names', () => {
    it('numbers a name that is already taken, ignoring case', () => {
        expect(uniqueDisplayName('Kitchen', [])).toBe('Kitchen')
        expect(uniqueDisplayName('Kitchen', ['kitchen'])).toBe('Kitchen 2')
        expect(uniqueDisplayName('Kitchen', ['Kitchen', 'Kitchen 2'])).toBe('Kitchen 3')
        expect(uniqueDisplayName('Kitchen 2', ['Kitchen', 'Kitchen 2'])).toBe('Kitchen 3')
        expect(uniqueDisplayName('  Hall  ', ['Kitchen'])).toBe('Hall')
    })

    it('keeps a numbered name within the length limit', () => {
        const long = 'x'.repeat(40)
        const name = uniqueDisplayName(long, [long], 40)
        expect(name).toHaveLength(40)
        expect(name.endsWith(' 2')).toBe(true)
    })

    it('pairing the same name twice gives Kitchen and Kitchen 2', async () => {
        const first = await pairedDisplay()
        const second = await pairedDisplay()
        const names = (await store.listDisplays('alice')).map((d) => d.name).sort()
        expect(names).toEqual(['Kitchen', 'Kitchen 2'])
        expect(first.id).not.toBe(second.id)
    })

    it('rename returns the final name and never collides with another display', async () => {
        const a = await pairedDisplay()
        const b = await pairedDisplay()
        await renameDisplay(store, 'alice', a.id, 'Hall')
        const saved = await renameDisplay(store, 'alice', b.id, 'hall')
        expect(saved.name).toBe('hall 2')
        // Renaming a display to its own name is not a collision.
        expect((await renameDisplay(store, 'alice', a.id, 'Hall')).name).toBe('Hall')
    })

    it('names are unique per cook, not across cooks', async () => {
        await pairedDisplay('alice')
        await pairedDisplay('bob')
        expect((await store.listDisplays('bob'))[0]?.name).toBe('Kitchen')
    })
})

describe('display presence', () => {
    it('tells unlinked, online and offline displays apart', async () => {
        const start = await startPairing(store, T0)
        const claim = await claimDisplayCode(store, 'alice', start.code, 'Kitchen', T0 + 1000)
        if (!claim.ok) throw new Error(claim.error)
        // Claimed on the phone, but the display never collected its token.
        const pending = await store.getDisplay(claim.display.id)
        expect(pending && displayPresence(pending, T0 + 2000)).toBe('unlinked')

        await pollPairing(store, start.pairingId, start.pollToken, T0 + 2000)
        // Collected its token but no heartbeat written yet: already connected.
        const fresh = await store.getDisplay(claim.display.id)
        expect(fresh && displayPresence({ ...fresh, lastSeenAt: null }, T0 + 2500)).toBe('online')
        await store.touchDisplay(claim.display.id, T0 + 3000)
        const linked = await store.getDisplay(claim.display.id)
        if (!linked) throw new Error('missing')
        expect(displayPresence(linked, T0 + 4000)).toBe('online')
        expect(displayPresence(linked, T0 + 3000 + DISPLAY_OFFLINE_AFTER_MS + 1)).toBe('offline')
    })
})
