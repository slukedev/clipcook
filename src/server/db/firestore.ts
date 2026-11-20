import 'server-only'

import { FieldValue, type Firestore, Timestamp } from 'firebase-admin/firestore'
import type { GroceryItem, PlanEntry, RecipeSummary } from '@/lib/domain/types'
import { finalizePlan, PlanLimitError, planEntriesFrom } from '@/lib/plan/entries'
import { todayIn } from '@/lib/plan/week'
import { adminDb } from '../firebase-admin'
import { byNewest, displayContentFrom, groceryItemsFrom, millis, recipeFromData, summaryOf } from './normalize'
import {
    type CastTokenRecord,
    type ClaimPairingResult,
    type ClipDraftRecord,
    type CollectionRecord,
    type CollectPairingResult,
    DEFAULT_INSTANCE,
    type DisplayRecord,
    type InstanceRecord,
    isAbandonedDisplay,
    type Mutator,
    type PairingRecord,
    type RecipeRecord,
    reusedDisplayFields,
    type Store,
    StoreError,
} from './types'

const RECIPES = 'allRecipes'
const COLLECTIONS = 'collections'
const GROCERY = 'groceryLists'
const MEAL_PLANS = 'mealPlans'
const DISPLAYS = 'displays'
const PAIRINGS = 'displayPairings'
const DRAFTS = 'clipDrafts'
const CAST_TOKENS = 'castTokens'
const INSTANCE = 'instance'
const INSTANCE_DOC = 'config'

// Everything a library card needs, and never the legacy inline `image` (up to ~900 KB per doc).
const SUMMARY_FIELDS = [
    'uid',
    'title',
    'servings',
    'thumbnail',
    'thumbnailUrl',
    'imageUrl',
    'seedColor',
    'tags',
    'collectionIds',
    'favorite',
    'totalMinutes',
    'totalTime',
    'prepTime',
    'cookTime',
    'sourceName',
    'sourceUrl',
    'createdAt',
    'updatedAt',
    'lastCookedAt',
    'cookCount',
]

const BATCH_LIMIT = 400

type Data = Record<string, unknown>

function recipeToDoc(r: RecipeRecord): Data {
    const photo = r.imagePath
        ? {
              imageUrl: r.image,
              thumbnailUrl: r.thumbnail,
              imagePath: r.imagePath,
              thumbnailPath: r.thumbnailPath,
              image: '',
              thumbnail: '',
          }
        : {
              image: r.image,
              thumbnail: r.thumbnail,
              imageUrl: null,
              thumbnailUrl: null,
              imagePath: null,
              thumbnailPath: null,
          }
    return {
        uid: r.uid,
        title: r.title,
        description: r.description,
        servings: r.servings,
        prepTime: r.prepTime,
        cookTime: r.cookTime,
        totalTime: r.totalTime,
        totalMinutes: r.totalMinutes,
        ingredients: r.ingredients,
        instructions: r.instructions,
        notes: r.notes,
        seedColor: r.seedColor,
        tags: r.tags,
        collectionIds: r.collectionIds,
        favorite: r.favorite,
        sourceUrl: r.sourceUrl,
        sourceName: r.sourceName,
        cookCount: r.cookCount,
        lastCookedAt: r.lastCookedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        ...photo,
    }
}

function collectionFromData(id: string, d: Data): CollectionRecord {
    const createdAt = millis(d.createdAt) ?? 0
    return {
        id,
        uid: String(d.uid ?? ''),
        name: String(d.name ?? ''),
        createdAt,
        updatedAt: millis(d.updatedAt) ?? createdAt,
    }
}

function displayFromData(id: string, d: Data): DisplayRecord {
    return {
        id,
        uid: String(d.uid ?? ''),
        name: String(d.name ?? ''),
        tokenHash: typeof d.tokenHash === 'string' ? d.tokenHash : null,
        createdAt: millis(d.createdAt) ?? 0,
        lastSeenAt: millis(d.lastSeenAt),
        current: displayContentFrom(d.current),
        version: typeof d.version === 'number' ? d.version : 0,
        castDeviceId: typeof d.castDeviceId === 'string' ? d.castDeviceId : null,
        deviceId: typeof d.deviceId === 'string' ? d.deviceId : null,
    }
}

function displayToDoc(r: DisplayRecord): Data {
    const { id: _id, ...rest } = r
    return rest
}

function pairingFromData(id: string, d: Data): PairingRecord {
    const claimed = d.claimedBy as { uid?: unknown; displayId?: unknown } | null | undefined
    return {
        id,
        code: String(d.code ?? ''),
        pollTokenHash: String(d.pollTokenHash ?? ''),
        createdAt: millis(d.createdAt) ?? 0,
        expiresAt: millis(d.expiresAt) ?? 0,
        claimedBy:
            claimed && typeof claimed.uid === 'string' && typeof claimed.displayId === 'string'
                ? { uid: claimed.uid, displayId: claimed.displayId }
                : null,
        deviceId: typeof d.deviceId === 'string' ? d.deviceId : null,
    }
}

/** TTL policies only act on Timestamp fields, so expiries are stored as Timestamps. */
const ts = (ms: number) => Timestamp.fromMillis(ms)

export class FirestoreStore implements Store {
    readonly backend = 'firebase' as const
    private readonly db: Firestore

    constructor(db: Firestore = adminDb()) {
        this.db = db
    }

    newId(): string {
        return this.db.collection(RECIPES).doc().id
    }

    // ---- recipes

    async listRecipeSummaries(uid: string): Promise<RecipeSummary[]> {
        const snap = await this.db
            .collection(RECIPES)
            .where('uid', '==', uid)
            .select(...SUMMARY_FIELDS)
            .get()
        return snap.docs.map((doc) => summaryOf(recipeFromData(doc.id, doc.data()))).sort(byNewest)
    }

    async listRecipes(uid: string): Promise<RecipeRecord[]> {
        const snap = await this.db.collection(RECIPES).where('uid', '==', uid).get()
        return snap.docs.map((doc) => recipeFromData(doc.id, doc.data())).sort(byNewest)
    }

    async getRecipe(uid: string, id: string): Promise<RecipeRecord | null> {
        const doc = await this.db.collection(RECIPES).doc(id).get()
        const data = doc.data()
        if (!doc.exists || !data || data.uid !== uid) return null
        return recipeFromData(doc.id, data)
    }

    async createRecipe(record: RecipeRecord): Promise<void> {
        try {
            await this.db.collection(RECIPES).doc(record.id).create(recipeToDoc(record))
        } catch (err) {
            if ((err as { code?: number }).code === 6) throw new StoreError('CONFLICT')
            throw err
        }
    }

    updateRecipe(uid: string, id: string, mutate: Mutator<RecipeRecord>): Promise<RecipeRecord> {
        const ref = this.db.collection(RECIPES).doc(id)
        return this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref)
            const data = snap.data()
            if (!snap.exists || !data || data.uid !== uid) throw new StoreError('NOT_FOUND')
            const current = recipeFromData(id, data)
            const patch = mutate(current)
            if (!patch) return current
            const next: RecipeRecord = { ...current, ...patch, id, uid }
            // merge keeps unknown legacy fields intact.
            tx.set(ref, recipeToDoc(next), { merge: true })
            return next
        })
    }

    async deleteRecipe(uid: string, id: string): Promise<RecipeRecord> {
        const ref = this.db.collection(RECIPES).doc(id)
        return this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref)
            const data = snap.data()
            if (!snap.exists || !data || data.uid !== uid) throw new StoreError('NOT_FOUND')
            tx.delete(ref)
            return recipeFromData(id, data)
        })
    }

    // ---- collections

    async listCollections(uid: string): Promise<CollectionRecord[]> {
        const snap = await this.db.collection(COLLECTIONS).where('uid', '==', uid).get()
        return snap.docs.map((d) => collectionFromData(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name))
    }

    async getCollection(uid: string, id: string): Promise<CollectionRecord | null> {
        const doc = await this.db.collection(COLLECTIONS).doc(id).get()
        const data = doc.data()
        return doc.exists && data && data.uid === uid ? collectionFromData(doc.id, data) : null
    }

    async createCollection(record: CollectionRecord): Promise<void> {
        const { id, ...rest } = record
        await this.db.collection(COLLECTIONS).doc(id).create(rest)
    }

    updateCollection(uid: string, id: string, mutate: Mutator<CollectionRecord>): Promise<CollectionRecord> {
        const ref = this.db.collection(COLLECTIONS).doc(id)
        return this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref)
            const data = snap.data()
            if (!snap.exists || !data || data.uid !== uid) throw new StoreError('NOT_FOUND')
            const current = collectionFromData(id, data)
            const patch = mutate(current)
            if (!patch) return current
            const next = { ...current, ...patch, id, uid }
            const { id: _id, ...doc } = next
            tx.set(ref, doc)
            return next
        })
    }

    async deleteCollection(uid: string, id: string): Promise<void> {
        const ref = this.db.collection(COLLECTIONS).doc(id)
        const snap = await ref.get()
        if (!snap.exists || snap.data()?.uid !== uid) throw new StoreError('NOT_FOUND')
        // Membership lives on recipes; strip it first so a failure never leaves dangling ids.
        const members = await this.db
            .collection(RECIPES)
            .where('uid', '==', uid)
            .where('collectionIds', 'array-contains', id)
            .select()
            .get()
        for (let i = 0; i < members.docs.length; i += BATCH_LIMIT) {
            const batch = this.db.batch()
            for (const doc of members.docs.slice(i, i + BATCH_LIMIT)) {
                batch.update(doc.ref, { collectionIds: FieldValue.arrayRemove(id) })
            }
            await batch.commit()
        }
        await ref.delete()
    }

    async setCollectionMembership(
        uid: string,
        collectionId: string,
        recipeIds: string[],
        member: boolean,
    ): Promise<number> {
        const collection = await this.getCollection(uid, collectionId)
        if (!collection) throw new StoreError('NOT_FOUND')
        const ids = [...new Set(recipeIds)]
        if (ids.length === 0) return 0
        const refs = ids.map((id) => this.db.collection(RECIPES).doc(id))
        const snaps = await this.db.getAll(...refs, { fieldMask: ['uid', 'collectionIds'] })
        const owned = snaps.filter((s) => s.exists && s.data()?.uid === uid)
        for (let i = 0; i < owned.length; i += BATCH_LIMIT) {
            const batch = this.db.batch()
            for (const snap of owned.slice(i, i + BATCH_LIMIT)) {
                batch.update(snap.ref, {
                    collectionIds: member ? FieldValue.arrayUnion(collectionId) : FieldValue.arrayRemove(collectionId),
                })
            }
            await batch.commit()
        }
        return owned.length
    }

    // ---- grocery

    async getGroceryItems(uid: string): Promise<GroceryItem[]> {
        const doc = await this.db.collection(GROCERY).doc(uid).get()
        return groceryItemsFrom(doc.data()?.items)
    }

    updateGroceryItems(uid: string, mutate: (items: GroceryItem[]) => GroceryItem[]): Promise<GroceryItem[]> {
        const ref = this.db.collection(GROCERY).doc(uid)
        return this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref)
            const next = mutate(groceryItemsFrom(snap.data()?.items))
            tx.set(ref, { uid, items: next, updatedAt: Date.now() })
            return next
        })
    }

    // ---- meal plan

    async getPlanEntries(uid: string): Promise<PlanEntry[]> {
        const doc = await this.db.collection(MEAL_PLANS).doc(uid).get()
        return planEntriesFrom(doc.data()?.entries)
    }

    updatePlanEntries(uid: string, mutate: (entries: PlanEntry[]) => PlanEntry[]): Promise<PlanEntry[]> {
        const ref = this.db.collection(MEAL_PLANS).doc(uid)
        return this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref)
            const current = planEntriesFrom(snap.data()?.entries)
            let next: PlanEntry[]
            try {
                next = finalizePlan(current, mutate(current.map((e) => ({ ...e }))), todayIn('UTC'))
            } catch (err) {
                if (err instanceof PlanLimitError) throw new StoreError('LIMIT', err.message)
                throw err
            }
            tx.set(ref, { uid, entries: next, updatedAt: Date.now() })
            return next
        })
    }

    // ---- displays

    async listDisplays(uid: string, now = Date.now()): Promise<DisplayRecord[]> {
        const snap = await this.db.collection(DISPLAYS).where('uid', '==', uid).get()
        const all = snap.docs.map((d) => displayFromData(d.id, d.data()))
        const abandoned = all.filter((d) => isAbandonedDisplay(d, now))
        if (abandoned.length > 0) {
            // No TTL policy can express "token never collected", so listing cleans up.
            const batch = this.db.batch()
            for (const d of abandoned) batch.delete(this.db.collection(DISPLAYS).doc(d.id))
            await batch.commit().catch(() => undefined)
        }
        return all.filter((d) => !isAbandonedDisplay(d, now)).sort(byNewest)
    }

    async getDisplay(id: string): Promise<DisplayRecord | null> {
        const doc = await this.db.collection(DISPLAYS).doc(id).get()
        const data = doc.data()
        return doc.exists && data ? displayFromData(doc.id, data) : null
    }

    async findCastDisplay(uid: string, castDeviceId: string): Promise<DisplayRecord | null> {
        const snap = await this.db
            .collection(DISPLAYS)
            .where('uid', '==', uid)
            .where('castDeviceId', '==', castDeviceId)
            .limit(1)
            .get()
        const doc = snap.docs[0]
        return doc ? displayFromData(doc.id, doc.data()) : null
    }

    async createDisplay(record: DisplayRecord): Promise<void> {
        await this.db.collection(DISPLAYS).doc(record.id).create(displayToDoc(record))
    }

    updateDisplay(uid: string, id: string, mutate: Mutator<DisplayRecord>): Promise<DisplayRecord> {
        const ref = this.db.collection(DISPLAYS).doc(id)
        return this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref)
            const data = snap.data()
            if (!snap.exists || !data || data.uid !== uid) throw new StoreError('NOT_FOUND')
            const current = displayFromData(id, data)
            const patch = mutate(current)
            if (!patch) return current
            const next = { ...current, ...patch, id, uid }
            tx.set(ref, displayToDoc(next))
            return next
        })
    }

    async touchDisplay(id: string, at: number): Promise<void> {
        await this.db
            .collection(DISPLAYS)
            .doc(id)
            .update({ lastSeenAt: at })
            .catch(() => undefined)
    }

    async deleteDisplay(uid: string, id: string): Promise<void> {
        const ref = this.db.collection(DISPLAYS).doc(id)
        await this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref)
            if (!snap.exists || snap.data()?.uid !== uid) throw new StoreError('NOT_FOUND')
            tx.delete(ref)
        })
    }

    // ---- pairing

    async createPairing(record: PairingRecord): Promise<void> {
        const { id, ...rest } = record
        await this.db
            .collection(PAIRINGS)
            .doc(id)
            .create({ ...rest, expiresAt: ts(rest.expiresAt) })
    }

    async getPairing(id: string): Promise<PairingRecord | null> {
        const doc = await this.db.collection(PAIRINGS).doc(id).get()
        const data = doc.data()
        return doc.exists && data ? pairingFromData(doc.id, data) : null
    }

    async findActivePairing(code: string, now: number): Promise<PairingRecord | null> {
        // Equality-only query: served by the automatic single-field index. Expiry is checked here.
        const snap = await this.db.collection(PAIRINGS).where('code', '==', code).limit(10).get()
        return (
            snap.docs
                .map((d) => pairingFromData(d.id, d.data()))
                .filter((p) => p.expiresAt > now)
                .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
        )
    }

    claimPairing(pairingId: string, display: DisplayRecord, now: number, reuse = false): Promise<ClaimPairingResult> {
        const pairingRef = this.db.collection(PAIRINGS).doc(pairingId)
        const displayRef = this.db.collection(DISPLAYS).doc(display.id)
        return this.db.runTransaction(async (tx) => {
            const [snap, displaySnap] = await Promise.all([
                tx.get(pairingRef),
                reuse ? tx.get(displayRef) : Promise.resolve(null),
            ])
            const data = snap.data()
            if (!snap.exists || !data) return 'not_found'
            const p = pairingFromData(pairingId, data)
            if (p.expiresAt <= now) return 'expired'
            if (p.claimedBy) return 'claimed'
            tx.update(pairingRef, { claimedBy: { uid: display.uid, displayId: display.id } })
            const existingData = displaySnap?.exists ? displaySnap.data() : undefined
            if (existingData && existingData.uid === display.uid) {
                tx.update(displayRef, reusedDisplayFields(displayFromData(display.id, existingData), display))
            } else {
                tx.set(displayRef, displayToDoc(display))
            }
            return 'ok'
        })
    }

    collectPairing(
        pairingId: string,
        pollTokenHash: string,
        displayTokenHash: string,
        now: number,
    ): Promise<CollectPairingResult> {
        const pairingRef = this.db.collection(PAIRINGS).doc(pairingId)
        return this.db.runTransaction(async (tx): Promise<CollectPairingResult> => {
            const snap = await tx.get(pairingRef)
            const data = snap.data()
            if (!snap.exists || !data) return { status: 'not_found' }
            const p = pairingFromData(pairingId, data)
            if (p.pollTokenHash !== pollTokenHash) return { status: 'not_found' }
            if (!p.claimedBy) return p.expiresAt <= now ? { status: 'expired' } : { status: 'pending' }
            const displayRef = this.db.collection(DISPLAYS).doc(p.claimedBy.displayId)
            const displaySnap = await tx.get(displayRef)
            tx.delete(pairingRef)
            if (!displaySnap.exists) return { status: 'not_found' }
            tx.update(displayRef, { tokenHash: displayTokenHash })
            return { status: 'claimed', displayId: displayRef.id }
        })
    }

    // ---- drafts and cast tokens

    async createClipDraft(record: ClipDraftRecord): Promise<void> {
        const { id, ...rest } = record
        await this.db
            .collection(DRAFTS)
            .doc(id)
            .create({ ...rest, expiresAt: ts(rest.expiresAt) })
    }

    async getClipDraft(id: string, now: number): Promise<ClipDraftRecord | null> {
        const doc = await this.db.collection(DRAFTS).doc(id).get()
        const data = doc.data()
        if (!doc.exists || !data) return null
        const expiresAt = millis(data.expiresAt) ?? 0
        if (expiresAt <= now) return null
        return {
            id,
            recipe: (data.recipe ?? {}) as ClipDraftRecord['recipe'],
            createdAt: millis(data.createdAt) ?? 0,
            expiresAt,
        }
    }

    async createCastToken(record: CastTokenRecord): Promise<void> {
        await this.db
            .collection(CAST_TOKENS)
            .doc(record.id)
            .create({ uid: record.uid, expiresAt: ts(record.expiresAt) })
    }

    consumeCastToken(id: string, now: number): Promise<string | null> {
        const ref = this.db.collection(CAST_TOKENS).doc(id)
        return this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref)
            const data = snap.data()
            if (!snap.exists || !data) return null
            tx.delete(ref)
            return (millis(data.expiresAt) ?? 0) > now && typeof data.uid === 'string' ? data.uid : null
        })
    }

    // ---- instance

    async getInstance(): Promise<InstanceRecord> {
        const doc = await this.db.collection(INSTANCE).doc(INSTANCE_DOC).get()
        return instanceFromData(doc.data())
    }

    updateInstance(mutate: Mutator<InstanceRecord>): Promise<InstanceRecord> {
        const ref = this.db.collection(INSTANCE).doc(INSTANCE_DOC)
        return this.db.runTransaction(async (tx) => {
            const current = instanceFromData((await tx.get(ref)).data())
            const patch = mutate(structuredClone(current))
            if (!patch) return current
            const next = { ...current, ...patch }
            tx.set(ref, next)
            return next
        })
    }
}

function instanceFromData(d: Record<string, unknown> | undefined): InstanceRecord {
    if (!d) return { ...DEFAULT_INSTANCE }
    const log = d.lastUpdate as Record<string, unknown> | null | undefined
    const outcome = log?.outcome
    return {
        ownerUid: typeof d.ownerUid === 'string' ? d.ownerUid : null,
        autoUpdate: typeof d.autoUpdate === 'boolean' ? d.autoUpdate : DEFAULT_INSTANCE.autoUpdate,
        lastUpdate:
            log && (outcome === 'current' || outcome === 'installed' || outcome === 'failed')
                ? {
                      at: typeof log.at === 'number' ? log.at : 0,
                      outcome,
                      upstreamSha: typeof log.upstreamSha === 'string' ? log.upstreamSha : null,
                      commitSha: typeof log.commitSha === 'string' ? log.commitSha : null,
                      error: typeof log.error === 'string' ? log.error : null,
                  }
                : null,
        lastScheduledAt: typeof d.lastScheduledAt === 'number' ? d.lastScheduledAt : null,
    }
}
