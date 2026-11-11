import type { DisplayContent, DisplayState, KitchenDisplay } from '@/lib/domain/types'
import { LIMITS } from '@/lib/domain/types'
import { CODE_PATTERN, normalizeCode, randomCode, randomToken, safeEqual, sha256 } from './crypto'
import type { DisplayRecord, Store } from './db/types'
import { StoreError } from './db/types'

export const PAIRING_TTL_MS = 10 * 60_000
export const CAST_TOKEN_TTL_MS = 2 * 60_000
/** lastSeenAt is written at most this often, so polling stays a single read. */
export const HEARTBEAT_INTERVAL_MS = 60_000

/** A display that has not polled for this long is treated as off or asleep. */
export const DISPLAY_OFFLINE_AFTER_MS = 3 * HEARTBEAT_INTERVAL_MS

/**
 * 'unlinked': the code was claimed but the display never collected its token, so it
 * cannot show anything. 'offline': linked, but not seen for a few minutes. 'online':
 * linked and seen recently, or just linked (lastSeenAt is written at most once a
 * minute, after the response, so a fresh display may not have one yet).
 */
export type DisplayPresence = 'online' | 'offline' | 'unlinked'

export function displayPresence(
    record: Pick<DisplayRecord, 'tokenHash' | 'lastSeenAt'>,
    now = Date.now(),
): DisplayPresence {
    if (!record.tokenHash) return 'unlinked'
    if (record.lastSeenAt === null) return 'online'
    return now - record.lastSeenAt > DISPLAY_OFFLINE_AFTER_MS ? 'offline' : 'online'
}

/**
 * A name no other display of this cook uses (ignoring case): 'Kitchen' becomes
 * 'Kitchen 2', then 'Kitchen 3', so every entry in the send menu is unambiguous.
 */
export function uniqueDisplayName(wanted: string, taken: Iterable<string>, max = LIMITS.displayName): string {
    const used = new Set([...taken].map((n) => n.trim().toLowerCase()))
    const name = wanted.trim().slice(0, max)
    if (!used.has(name.toLowerCase())) return name
    const base = name.replace(/\s+\d+$/, '') || name
    for (let n = 2; ; n++) {
        const suffix = ` ${n}`
        const candidate = `${base.slice(0, max - suffix.length).trimEnd()}${suffix}`
        if (!used.has(candidate.toLowerCase())) return candidate
    }
}

export interface PairingStart {
    code: string
    pairingId: string
    pollToken: string
    expiresAt: number
}

/** A new pairing code for a display that has no cookie yet. */
export async function startPairing(store: Store, now = Date.now()): Promise<PairingStart> {
    // Collisions are astronomically unlikely in a 10-minute window, but cheap to rule out.
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomCode(6)
        if (await store.findActivePairing(code, now)) continue
        const pairingId = randomToken(16)
        const pollToken = randomToken(32)
        const expiresAt = now + PAIRING_TTL_MS
        await store.createPairing({
            id: pairingId,
            code,
            pollTokenHash: sha256(pollToken),
            createdAt: now,
            expiresAt,
            claimedBy: null,
        })
        return { code, pairingId, pollToken, expiresAt }
    }
    throw new StoreError('CONFLICT', 'Could not allocate a pairing code')
}

export type ClaimError = 'invalid_code' | 'expired' | 'already_claimed' | 'too_many_displays'

export type ClaimResult = { ok: true; display: KitchenDisplay } | { ok: false; error: ClaimError }

/** A signed-in user types the code shown on the display. */
export async function claimDisplayCode(
    store: Store,
    uid: string,
    rawCode: string,
    name: string,
    now = Date.now(),
): Promise<ClaimResult> {
    const code = normalizeCode(rawCode)
    if (!CODE_PATTERN.test(code)) return { ok: false, error: 'invalid_code' }
    const pairing = await store.findActivePairing(code, now)
    if (!pairing) return { ok: false, error: 'invalid_code' }
    if (pairing.claimedBy) return { ok: false, error: 'already_claimed' }
    const existing = await store.listDisplays(uid)
    if (existing.length >= LIMITS.displays) return { ok: false, error: 'too_many_displays' }
    const record: DisplayRecord = {
        id: randomToken(12),
        uid,
        name: uniqueDisplayName(
            name.trim() || 'Kitchen display',
            existing.map((d) => d.name),
        ),
        tokenHash: null,
        createdAt: now,
        lastSeenAt: null,
        current: null,
        version: 1,
        castDeviceId: null,
    }
    const result = await store.claimPairing(pairing.id, record, now)
    if (result === 'ok') return { ok: true, display: toKitchenDisplay(record) }
    if (result === 'expired') return { ok: false, error: 'expired' }
    if (result === 'claimed') return { ok: false, error: 'already_claimed' }
    return { ok: false, error: 'invalid_code' }
}

export type PollResult =
    | { status: 'pending'; expiresAt?: number }
    | { status: 'expired' }
    | { status: 'not_found' }
    | { status: 'claimed'; displayId: string; cookie: string }

/** The display polls; once claimed it receives its long-lived token exactly once. */
export async function pollPairing(
    store: Store,
    pairingId: string,
    pollToken: string,
    now = Date.now(),
): Promise<PollResult> {
    const token = randomToken(32)
    const result = await store.collectPairing(pairingId, sha256(pollToken), sha256(token), now)
    if (result.status !== 'claimed') return result
    return { status: 'claimed', displayId: result.displayId, cookie: encodeDisplayCookie(result.displayId, token) }
}

/** Cookie value: '<displayId>.<token>'. Only the token's hash is stored. */
export function encodeDisplayCookie(displayId: string, token: string): string {
    return `${displayId}.${token}`
}

/** Resolves a display cookie to its display, or null if revoked, unknown, or forged. */
export async function authenticateDisplay(
    store: Store,
    cookie: string | undefined | null,
): Promise<DisplayRecord | null> {
    if (!cookie || cookie.length > 200) return null
    const dot = cookie.indexOf('.')
    if (dot <= 0) return null
    const id = cookie.slice(0, dot)
    const token = cookie.slice(dot + 1)
    if (!/^[A-Za-z0-9_-]+$/.test(id) || !token) return null
    const display = await store.getDisplay(id)
    if (!display?.tokenHash) return null
    return safeEqual(display.tokenHash, sha256(token)) ? display : null
}

export function needsHeartbeat(display: DisplayRecord, now = Date.now()): boolean {
    return display.lastSeenAt === null || now - display.lastSeenAt >= HEARTBEAT_INTERVAL_MS
}

export function toKitchenDisplay(record: DisplayRecord): KitchenDisplay {
    return {
        id: record.id,
        name: record.name,
        createdAt: record.createdAt,
        lastSeenAt: record.lastSeenAt,
        current: record.current,
    }
}

export function toDisplayState(record: DisplayRecord): DisplayState {
    return { id: record.id, name: record.name, current: record.current, version: record.version }
}

export function displayEtag(record: DisplayRecord): string {
    return `"d${record.version}"`
}

export async function sendToDisplay(
    store: Store,
    uid: string,
    id: string,
    content: Omit<DisplayContent, 'sentAt'>,
    now = Date.now(),
): Promise<DisplayRecord> {
    return store.updateDisplay(uid, id, (current) => {
        const same =
            current.current?.recipeId === content.recipeId &&
            current.current.step === content.step &&
            current.current.scale === content.scale
        // Repeated sends of the same step are free: no write, no version bump.
        if (same) return null
        return { current: { ...content, sentAt: now }, version: current.version + 1 }
    })
}

export async function clearDisplay(store: Store, uid: string, id: string): Promise<DisplayRecord> {
    return store.updateDisplay(uid, id, (current) =>
        current.current ? { current: null, version: current.version + 1 } : null,
    )
}

/** Renames a display; a name another display already uses gets a number. Returns the saved record. */
export async function renameDisplay(store: Store, uid: string, id: string, name: string): Promise<DisplayRecord> {
    const others = (await store.listDisplays(uid)).filter((d) => d.id !== id).map((d) => d.name)
    const unique = uniqueDisplayName(name, others)
    return store.updateDisplay(uid, id, (current) =>
        current.name === unique ? null : { name: unique, version: current.version + 1 },
    )
}

/** Deleting the record is the revocation: the next poll with that cookie fails. */
export async function removeDisplay(store: Store, uid: string, id: string): Promise<void> {
    await store.deleteDisplay(uid, id)
}

// ---------- Google Cast ----------

export async function createCastToken(
    store: Store,
    uid: string,
    now = Date.now(),
): Promise<{ token: string; expiresAt: number }> {
    const token = randomToken(24)
    const expiresAt = now + CAST_TOKEN_TTL_MS
    await store.createCastToken({ id: sha256(token), uid, expiresAt })
    return { token, expiresAt }
}

/**
 * A Cast receiver trades a one-time token for a display session. Receivers send a
 * stable device id so re-casting to the same Chromecast reuses its entry.
 */
export async function claimCastToken(
    store: Store,
    token: string,
    deviceId: string | null,
    name: string | null,
    now = Date.now(),
): Promise<{ displayId: string; cookie: string } | null> {
    const uid = await store.consumeCastToken(sha256(token), now)
    if (!uid) return null
    const displayToken = randomToken(32)
    const tokenHash = sha256(displayToken)
    const existing = deviceId ? await store.findCastDisplay(uid, deviceId) : null
    if (existing) {
        await store.updateDisplay(uid, existing.id, () => ({ tokenHash, lastSeenAt: now }))
        return { displayId: existing.id, cookie: encodeDisplayCookie(existing.id, displayToken) }
    }
    const all = await store.listDisplays(uid)
    if (all.length >= LIMITS.displays) return null
    const record: DisplayRecord = {
        id: randomToken(12),
        uid,
        name: uniqueDisplayName(
            name?.trim() || 'Chromecast',
            all.map((d) => d.name),
        ),
        tokenHash,
        createdAt: now,
        lastSeenAt: now,
        current: null,
        version: 1,
        castDeviceId: deviceId,
    }
    await store.createDisplay(record)
    return { displayId: record.id, cookie: encodeDisplayCookie(record.id, displayToken) }
}
