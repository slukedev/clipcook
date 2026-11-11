import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { GroceryItem, RecipeSummary } from '@/lib/domain/types'
import { byNewest, recipeFromData, summaryOf } from './normalize'
import {
    type CastTokenRecord,
    type ClaimPairingResult,
    type ClipDraftRecord,
    type CollectionRecord,
    type CollectPairingResult,
    type DisplayRecord,
    type Mutator,
    type PairingRecord,
    type RecipeRecord,
    type Store,
    StoreError,
} from './types'

interface LocalData {
    version: 1
    recipes: Record<string, RecipeRecord>
    collections: Record<string, CollectionRecord>
    grocery: Record<string, GroceryItem[]>
    displays: Record<string, DisplayRecord>
    pairings: Record<string, PairingRecord>
    drafts: Record<string, ClipDraftRecord>
    castTokens: Record<string, CastTokenRecord>
}

function emptyData(): LocalData {
    return {
        version: 1,
        recipes: {},
        collections: {},
        grocery: {},
        displays: {},
        pairings: {},
        drafts: {},
        castTokens: {},
    }
}

const clone = <T>(value: T): T => structuredClone(value)

export function localDataDir(): string {
    // The folder is chosen at runtime and holds user data, never code: keep it out of output tracing.
    return path.resolve(/*turbopackIgnore: true*/ process.env.CLIPCOOK_DATA_DIR || path.join(process.cwd(), '.data'))
}

/**
 * JSON-file store for development, demos, E2E tests, and contributors without
 * Firebase. Every operation runs under one in-process mutex and every write goes
 * through a temp file plus rename, so a crash never leaves half a file behind.
 * Another process writing the same file is picked up by checking mtime and size.
 */
export class LocalStore implements Store {
    readonly backend = 'local' as const
    private readonly file: string
    private data: LocalData | null = null
    private loadedStamp = ''
    private queue: Promise<unknown> = Promise.resolve()

    constructor(dir = localDataDir()) {
        this.file = path.join(dir, 'clipcook.json')
    }

    newId(): string {
        return randomBytes(15).toString('base64url')
    }

    private async stamp(): Promise<string> {
        try {
            const st = await stat(this.file)
            return `${st.mtimeMs}:${st.size}`
        } catch {
            return 'missing'
        }
    }

    private async load(): Promise<LocalData> {
        const current = await this.stamp()
        if (this.data && current === this.loadedStamp) return this.data
        if (current === 'missing') {
            this.data = emptyData()
        } else {
            try {
                const parsed = JSON.parse(await readFile(this.file, 'utf8')) as Partial<LocalData>
                this.data = { ...emptyData(), ...parsed, version: 1 }
            } catch (err) {
                throw new Error(`Could not read ${this.file}: ${(err as Error).message}`)
            }
        }
        this.loadedStamp = current
        return this.data
    }

    private async save(data: LocalData): Promise<void> {
        await mkdir(path.dirname(this.file), { recursive: true })
        const tmp = `${this.file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
        await writeFile(tmp, JSON.stringify(data), { mode: 0o600 })
        await rename(tmp, this.file)
        this.loadedStamp = await this.stamp()
    }

    /**
     * Serializes all access. In write mode the file is saved after `fn` succeeds,
     * unless `fn` called `unchanged()` and nothing expired: display pairing polls
     * every few seconds and should not rewrite the whole file each time.
     */
    private run<T>(fn: (data: LocalData, unchanged: () => void) => T | Promise<T>, write: boolean): Promise<T> {
        const next = this.queue.then(async () => {
            const data = await this.load()
            if (!write) return fn(data, () => undefined)
            let dirty = true
            try {
                const result = await fn(data, () => {
                    dirty = false
                })
                if (pruneExpired(data, Date.now())) dirty = true
                if (dirty) await this.save(data)
                return result
            } catch (err) {
                // The mutation may have been partly applied in memory; reload from disk next time.
                this.data = null
                this.loadedStamp = ''
                throw err
            }
        })
        this.queue = next.catch(() => undefined)
        return next
    }

    private read<T>(fn: (data: LocalData) => T): Promise<T> {
        return this.run((d) => clone(fn(d)), false)
    }

    /** `fn` calls `unchanged()` on paths that leave the data as it was. */
    private write<T>(fn: (data: LocalData, unchanged: () => void) => T): Promise<T> {
        return this.run((d, unchanged) => clone(fn(d, unchanged)), true)
    }

    // ---- recipes

    listRecipeSummaries(uid: string): Promise<RecipeSummary[]> {
        return this.read((d) => ownedRecipes(d, uid).map(summaryOf))
    }

    listRecipes(uid: string): Promise<RecipeRecord[]> {
        return this.read((d) => ownedRecipes(d, uid))
    }

    getRecipe(uid: string, id: string): Promise<RecipeRecord | null> {
        return this.read((d) => {
            const r = d.recipes[id]
            return r && r.uid === uid ? recipeFromData(id, r as unknown as Record<string, unknown>) : null
        })
    }

    createRecipe(record: RecipeRecord): Promise<void> {
        return this.write((d) => {
            if (d.recipes[record.id]) throw new StoreError('CONFLICT')
            d.recipes[record.id] = clone(record)
        })
    }

    updateRecipe(uid: string, id: string, mutate: Mutator<RecipeRecord>): Promise<RecipeRecord> {
        return this.write((d) => {
            const current = d.recipes[id]
            if (!current || current.uid !== uid) throw new StoreError('NOT_FOUND')
            const patch = mutate(clone(current))
            if (!patch) return current
            const next = { ...current, ...patch, id, uid }
            d.recipes[id] = next
            return next
        })
    }

    deleteRecipe(uid: string, id: string): Promise<RecipeRecord> {
        return this.write((d) => {
            const current = d.recipes[id]
            if (!current || current.uid !== uid) throw new StoreError('NOT_FOUND')
            delete d.recipes[id]
            for (const display of Object.values(d.displays)) {
                if (display.uid === uid && display.current?.recipeId === id) {
                    display.current = null
                    display.version += 1
                }
            }
            return current
        })
    }

    // ---- collections

    listCollections(uid: string): Promise<CollectionRecord[]> {
        return this.read((d) =>
            Object.values(d.collections)
                .filter((c) => c.uid === uid)
                .sort((a, b) => a.name.localeCompare(b.name)),
        )
    }

    getCollection(uid: string, id: string): Promise<CollectionRecord | null> {
        return this.read((d) => {
            const c = d.collections[id]
            return c && c.uid === uid ? c : null
        })
    }

    createCollection(record: CollectionRecord): Promise<void> {
        return this.write((d) => {
            if (d.collections[record.id]) throw new StoreError('CONFLICT')
            d.collections[record.id] = clone(record)
        })
    }

    updateCollection(uid: string, id: string, mutate: Mutator<CollectionRecord>): Promise<CollectionRecord> {
        return this.write((d) => {
            const current = d.collections[id]
            if (!current || current.uid !== uid) throw new StoreError('NOT_FOUND')
            const patch = mutate(clone(current))
            if (!patch) return current
            const next = { ...current, ...patch, id, uid }
            d.collections[id] = next
            return next
        })
    }

    deleteCollection(uid: string, id: string): Promise<void> {
        return this.write((d) => {
            const current = d.collections[id]
            if (!current || current.uid !== uid) throw new StoreError('NOT_FOUND')
            delete d.collections[id]
            for (const r of Object.values(d.recipes)) {
                if (r.uid === uid && r.collectionIds.includes(id))
                    r.collectionIds = r.collectionIds.filter((c) => c !== id)
            }
        })
    }

    setCollectionMembership(uid: string, collectionId: string, recipeIds: string[], member: boolean): Promise<number> {
        return this.write((d) => {
            const c = d.collections[collectionId]
            if (!c || c.uid !== uid) throw new StoreError('NOT_FOUND')
            let changed = 0
            for (const id of new Set(recipeIds)) {
                const r = d.recipes[id]
                if (!r || r.uid !== uid) continue
                const has = r.collectionIds.includes(collectionId)
                if (member && !has) r.collectionIds = [...r.collectionIds, collectionId]
                else if (!member && has) r.collectionIds = r.collectionIds.filter((x) => x !== collectionId)
                else continue
                changed++
            }
            return changed
        })
    }

    // ---- grocery

    getGroceryItems(uid: string): Promise<GroceryItem[]> {
        return this.read((d) => d.grocery[uid] ?? [])
    }

    updateGroceryItems(uid: string, mutate: (items: GroceryItem[]) => GroceryItem[]): Promise<GroceryItem[]> {
        return this.write((d) => {
            const next = mutate(clone(d.grocery[uid] ?? []))
            d.grocery[uid] = next
            return next
        })
    }

    // ---- displays

    listDisplays(uid: string): Promise<DisplayRecord[]> {
        return this.read((d) =>
            Object.values(d.displays)
                .filter((x) => x.uid === uid)
                .sort(byNewest),
        )
    }

    getDisplay(id: string): Promise<DisplayRecord | null> {
        return this.read((d) => d.displays[id] ?? null)
    }

    findCastDisplay(uid: string, castDeviceId: string): Promise<DisplayRecord | null> {
        return this.read(
            (d) => Object.values(d.displays).find((x) => x.uid === uid && x.castDeviceId === castDeviceId) ?? null,
        )
    }

    createDisplay(record: DisplayRecord): Promise<void> {
        return this.write((d) => {
            if (d.displays[record.id]) throw new StoreError('CONFLICT')
            d.displays[record.id] = clone(record)
        })
    }

    updateDisplay(uid: string, id: string, mutate: Mutator<DisplayRecord>): Promise<DisplayRecord> {
        return this.write((d) => {
            const current = d.displays[id]
            if (!current || current.uid !== uid) throw new StoreError('NOT_FOUND')
            const patch = mutate(clone(current))
            if (!patch) return current
            const next = { ...current, ...patch, id, uid }
            d.displays[id] = next
            return next
        })
    }

    touchDisplay(id: string, at: number): Promise<void> {
        return this.write((d, unchanged) => {
            const current = d.displays[id]
            if (current) current.lastSeenAt = at
            else unchanged()
        })
    }

    deleteDisplay(uid: string, id: string): Promise<void> {
        return this.write((d) => {
            const current = d.displays[id]
            if (!current || current.uid !== uid) throw new StoreError('NOT_FOUND')
            delete d.displays[id]
        })
    }

    // ---- pairing

    createPairing(record: PairingRecord): Promise<void> {
        return this.write((d) => {
            d.pairings[record.id] = clone(record)
        })
    }

    getPairing(id: string): Promise<PairingRecord | null> {
        return this.read((d) => d.pairings[id] ?? null)
    }

    findActivePairing(code: string, now: number): Promise<PairingRecord | null> {
        return this.read(
            (d) =>
                Object.values(d.pairings)
                    .filter((p) => p.code === code && p.expiresAt > now)
                    .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
        )
    }

    claimPairing(pairingId: string, display: DisplayRecord, now: number): Promise<ClaimPairingResult> {
        return this.write((d) => {
            const p = d.pairings[pairingId]
            if (!p) return 'not_found'
            if (p.expiresAt <= now) return 'expired'
            if (p.claimedBy) return 'claimed'
            p.claimedBy = { uid: display.uid, displayId: display.id }
            d.displays[display.id] = clone(display)
            return 'ok'
        })
    }

    collectPairing(
        pairingId: string,
        pollTokenHash: string,
        displayTokenHash: string,
        now: number,
    ): Promise<CollectPairingResult> {
        return this.write((d, unchanged): CollectPairingResult => {
            const p = d.pairings[pairingId]
            if (!p || p.pollTokenHash !== pollTokenHash || !p.claimedBy) {
                unchanged()
                if (!p || p.pollTokenHash !== pollTokenHash) return { status: 'not_found' }
                return p.expiresAt <= now ? { status: 'expired' } : { status: 'pending' }
            }
            const display = d.displays[p.claimedBy.displayId]
            delete d.pairings[pairingId]
            if (!display) return { status: 'not_found' }
            display.tokenHash = displayTokenHash
            return { status: 'claimed', displayId: display.id }
        })
    }

    // ---- drafts and cast tokens

    createClipDraft(record: ClipDraftRecord): Promise<void> {
        return this.write((d) => {
            d.drafts[record.id] = clone(record)
        })
    }

    getClipDraft(id: string, now: number): Promise<ClipDraftRecord | null> {
        return this.read((d) => {
            const draft = d.drafts[id]
            return draft && draft.expiresAt > now ? draft : null
        })
    }

    createCastToken(record: CastTokenRecord): Promise<void> {
        return this.write((d) => {
            d.castTokens[record.id] = clone(record)
        })
    }

    consumeCastToken(id: string, now: number): Promise<string | null> {
        return this.write((d, unchanged) => {
            const token = d.castTokens[id]
            if (!token) {
                unchanged()
                return null
            }
            delete d.castTokens[id]
            return token.expiresAt > now ? token.uid : null
        })
    }
}

function ownedRecipes(d: LocalData, uid: string): RecipeRecord[] {
    return Object.values(d.recipes)
        .filter((r) => r.uid === uid)
        .map((r) => recipeFromData(r.id, r as unknown as Record<string, unknown>))
        .sort(byNewest)
}

/** Returns true when anything was removed. */
function pruneExpired(d: LocalData, now: number): boolean {
    let removed = false
    const drop = <T>(table: Record<string, T>, expired: (x: T) => boolean) => {
        for (const [id, x] of Object.entries(table)) {
            if (expired(x)) {
                delete table[id]
                removed = true
            }
        }
    }
    // Claimed pairings linger a little so a display that was offline can still collect its token.
    drop(d.pairings, (p) => p.expiresAt + 60 * 60_000 < now)
    drop(d.drafts, (x) => x.expiresAt < now)
    drop(d.castTokens, (x) => x.expiresAt < now)
    return removed
}
