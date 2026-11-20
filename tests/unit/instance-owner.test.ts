import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_INSTANCE, type InstanceRecord, type Mutator } from '@/server/db/types'

// A Firebase-backed instance with its users in memory.
interface FakeUser {
    uid: string
    metadata: { creationTime: string }
    email?: string
    emailVerified?: boolean
    disabled?: boolean
}
let users: FakeUser[] = []
let record: InstanceRecord = { ...DEFAULT_INSTANCE }

vi.mock('@/server/firebase-admin', () => ({
    adminAuth: () => ({
        listUsers: async (max: number, pageToken?: string) => {
            const start = Number(pageToken ?? 0)
            const page = users.slice(start, start + Math.min(max, 2))
            const next = start + page.length
            return { users: page, pageToken: next < users.length ? String(next) : undefined }
        },
        getUserByEmail: async (email: string) => {
            const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
            if (!user) throw Object.assign(new Error('missing'), { code: 'auth/user-not-found' })
            return user
        },
        getUser: async (uid: string) => {
            const user = users.find((u) => u.uid === uid)
            if (!user) throw Object.assign(new Error('missing'), { code: 'auth/user-not-found' })
            return user
        },
    }),
}))

vi.mock('@/server/db', () => ({
    getStore: async () => ({
        backend: 'firebase',
        getInstance: async () => structuredClone(record),
        updateInstance: async (mutate: Mutator<InstanceRecord>) => {
            const patch = mutate(structuredClone(record))
            if (patch) record = { ...record, ...patch }
            return structuredClone(record)
        },
    }),
    backend: () => 'firebase',
}))

const { instanceOwner, isInstanceOwner, ownerOverride, resetInstanceOwnerCache } = await import(
    '@/server/instance-owner'
)

const user = (uid: string, created: string, extra: Partial<FakeUser> = {}): FakeUser => ({
    uid,
    metadata: { creationTime: new Date(created).toUTCString() },
    ...extra,
})

describe('instanceOwner', () => {
    beforeEach(() => {
        resetInstanceOwnerCache()
        record = { ...DEFAULT_INSTANCE }
        // Listed out of creation order and across pages, as Firebase returns them.
        users = [user('second', '2026-03-02'), user('later', '2026-05-01'), user('first', '2026-03-01')]
    })

    it('picks the oldest account across pages and stores it', async () => {
        expect(await instanceOwner()).toBe('first')
        expect(record.ownerUid).toBe('first')
        expect(await isInstanceOwner('second')).toBe(false)
    })

    it('keeps the stored owner when an older-looking account appears later', async () => {
        record.ownerUid = 'second'
        users.push(user('imported', '2020-01-01'))
        expect(await instanceOwner()).toBe('second')
    })

    it('hands over to the next oldest when the owner account is deleted', async () => {
        record.ownerUid = 'first'
        users = users.filter((u) => u.uid !== 'first')
        expect(await instanceOwner()).toBe('second')
        expect(record.ownerUid).toBe('second')
    })

    it('has no owner before anyone signs up', async () => {
        users = []
        expect(await instanceOwner()).toBeNull()
        expect(await isInstanceOwner('anyone')).toBe(false)
    })
})

describe('CLIPCOOK_OWNER', () => {
    beforeEach(() => {
        resetInstanceOwnerCache()
        record = { ...DEFAULT_INSTANCE, ownerUid: 'first' }
        users = [
            user('first', '2026-03-01'),
            user('friend', '2026-04-01', { email: 'Friend@Example.com', emailVerified: true }),
            user('impostor', '2026-04-02', { email: 'boss@example.com', emailVerified: false }),
            user('banned', '2026-04-03', { email: 'banned@example.com', emailVerified: true, disabled: true }),
        ]
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('hands updates to the account it names, by id or by verified email, without touching the stored owner', async () => {
        vi.stubEnv('CLIPCOOK_OWNER', 'friend')
        expect(await instanceOwner()).toBe('friend')
        resetInstanceOwnerCache()
        vi.stubEnv('CLIPCOOK_OWNER', '  friend@EXAMPLE.com ')
        expect(await isInstanceOwner('friend')).toBe(true)
        expect(await isInstanceOwner('first')).toBe(false)
        expect(record.ownerUid).toBe('first')
        // Removing it hands updates back.
        resetInstanceOwnerCache()
        vi.stubEnv('CLIPCOOK_OWNER', '')
        expect(await instanceOwner()).toBe('first')
    })

    it('gives nobody updates when it names an unverified email, a disabled account, or no one', async () => {
        for (const value of [
            'boss@example.com',
            'banned@example.com',
            'banned',
            'nobody@example.com',
            'typo-uid',
            'not an id',
            'a@b',
        ]) {
            resetInstanceOwnerCache()
            vi.stubEnv('CLIPCOOK_OWNER', value)
            expect(await instanceOwner(), value).toBeNull()
            expect(await isInstanceOwner('first'), value).toBe(false)
        }
    })

    it('parses only well-formed ids and emails', () => {
        expect(ownerOverride(undefined)).toBeNull()
        expect(ownerOverride(' ')).toBeNull()
        expect(ownerOverride('Ab_1-x')).toEqual({ kind: 'uid', uid: 'Ab_1-x' })
        expect(ownerOverride('Me@Example.COM')).toEqual({ kind: 'email', email: 'me@example.com' })
        expect(ownerOverride('../etc/passwd')).toBe('invalid')
        expect(ownerOverride('me@localhost')).toBe('invalid')
    })
})
