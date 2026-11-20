import 'server-only'

import { DEMO_USER } from './auth'
import { getStore } from './db'

const RECHECK_MS = 10 * 60_000

// Per process, like the store: the owner only changes if their account is deleted.
const holder = globalThis as typeof globalThis & { __clipcookOwner?: { uid: string | null; at: number } }

async function adminAuth() {
    const mod = await import('./firebase-admin')
    return mod.adminAuth()
}

/** The oldest active, verified account in Firebase Auth, by creation time. */
async function oldestFirebaseUser(): Promise<string | null> {
    const auth = await adminAuth()
    let oldest: { uid: string; created: number } | null = null
    let pageToken: string | undefined
    do {
        const page = await auth.listUsers(1000, pageToken)
        for (const user of page.users) {
            // Only an active account Google has verified can hold updates.
            if (user.disabled || !user.emailVerified) continue
            const created = Date.parse(user.metadata.creationTime)
            if (Number.isNaN(created)) continue
            if (!oldest || created < oldest.created) oldest = { uid: user.uid, created }
        }
        pageToken = page.pageToken
    } while (pageToken)
    return oldest?.uid ?? null
}

/** Whether the stored owner can still hold updates; a disabled account hands them on. */
async function stillActive(uid: string): Promise<boolean> {
    try {
        const user = await (await adminAuth()).getUser(uid)
        return !user.disabled
    } catch (err) {
        if ((err as { code?: string }).code === 'auth/user-not-found') return false
        throw err
    }
}

export type OwnerOverride = { kind: 'uid'; uid: string } | { kind: 'email'; email: string }

const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** CLIPCOOK_OWNER: an account id, or the verified email of an account. Anything else is ignored. */
export function ownerOverride(
    value: string | undefined = process.env.CLIPCOOK_OWNER,
): OwnerOverride | 'invalid' | null {
    const raw = value?.trim()
    if (!raw) return null
    if (raw.includes('@')) return EMAIL_PATTERN.test(raw) ? { kind: 'email', email: raw.toLowerCase() } : 'invalid'
    return UID_PATTERN.test(raw) ? { kind: 'uid', uid: raw } : 'invalid'
}

/**
 * The account CLIPCOOK_OWNER names, checked against Firebase Auth rather than the
 * session: an email counts only once Google has verified it, and a disabled account
 * never counts. No match means no owner, so a typo can't leave updates with whoever
 * held them before.
 */
async function resolveOverride(
    override: OwnerOverride | 'invalid',
    backend: 'firebase' | 'local',
): Promise<string | null> {
    if (override === 'invalid') return null
    if (backend === 'local') return override.kind === 'uid' && override.uid === DEMO_USER.uid ? DEMO_USER.uid : null
    const auth = await adminAuth()
    try {
        const user =
            override.kind === 'uid' ? await auth.getUser(override.uid) : await auth.getUserByEmail(override.email)
        if (user.disabled) return null
        if (override.kind === 'email' && (!user.emailVerified || user.email?.toLowerCase() !== override.email)) {
            return null
        }
        return user.uid
    } catch (err) {
        if ((err as { code?: string }).code === 'auth/user-not-found') return null
        throw err
    }
}

/**
 * Who manages updates. CLIPCOOK_OWNER wins while it is set. Otherwise it is the
 * first account created on this instance, worked out once and then stored so later
 * sign-ups never change it; if that account is deleted, the next oldest takes over.
 */
export async function instanceOwner(now = Date.now()): Promise<string | null> {
    const cached = holder.__clipcookOwner
    if (cached && now - cached.at < RECHECK_MS) return cached.uid

    const store = await getStore()
    const override = ownerOverride()
    let uid: string | null
    if (override) {
        uid = await resolveOverride(override, store.backend)
        if (!uid && process.env.NODE_ENV !== 'test') {
            console.warn('CLIPCOOK_OWNER matches no active account with a verified email; nobody can manage updates.')
        }
    } else {
        const { ownerUid } = await store.getInstance()
        if (store.backend === 'local') {
            // The local backend has one account.
            uid = DEMO_USER.uid
            if (ownerUid !== uid) await store.updateInstance(() => ({ ownerUid: uid }))
        } else if (ownerUid && (await stillActive(ownerUid))) {
            uid = ownerUid
        } else {
            const oldest = await oldestFirebaseUser()
            const saved = await store.updateInstance((current) =>
                current.ownerUid === ownerUid ? { ownerUid: oldest } : null,
            )
            uid = saved.ownerUid
            if (ownerUid && uid !== ownerUid && process.env.NODE_ENV !== 'test') {
                console.warn(
                    `Updates passed from account ${ownerUid} to ${uid ?? 'nobody'}. Set CLIPCOOK_OWNER to choose.`,
                )
            }
        }
    }
    holder.__clipcookOwner = { uid, at: now }
    return uid
}

export async function isInstanceOwner(uid: string): Promise<boolean> {
    return (await instanceOwner()) === uid
}

/** Tests only. */
export function resetInstanceOwnerCache(): void {
    holder.__clipcookOwner = undefined
}
