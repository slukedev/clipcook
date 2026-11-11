import type { DisplayContent, GroceryItem, ImportedRecipe, Recipe, RecipeSummary } from '@/lib/domain/types'

/** A stored recipe. `imagePath` set means image/thumbnail are Firebase Storage URLs we own. */
export interface RecipeRecord extends Recipe {
    uid: string
    imagePath: string | null
    thumbnailPath: string | null
}

export interface CollectionRecord {
    id: string
    uid: string
    name: string
    createdAt: number
    updatedAt: number
}

export interface DisplayRecord {
    id: string
    uid: string
    name: string
    /** SHA-256 of the display token; null until the display collects its token. */
    tokenHash: string | null
    createdAt: number
    lastSeenAt: number | null
    current: DisplayContent | null
    /** Bumped on every visible change; the display polls with it as an ETag. */
    version: number
    /** Set for displays created by a Cast receiver, so re-casting reuses the same entry. */
    castDeviceId: string | null
}

export interface PairingRecord {
    id: string
    code: string
    pollTokenHash: string
    createdAt: number
    expiresAt: number
    claimedBy: { uid: string; displayId: string } | null
}

export interface ClipDraftRecord {
    id: string
    recipe: ImportedRecipe
    createdAt: number
    expiresAt: number
}

export interface CastTokenRecord {
    /** SHA-256 of the token. */
    id: string
    uid: string
    expiresAt: number
}

export type ClaimPairingResult = 'ok' | 'not_found' | 'expired' | 'claimed'
export type CollectPairingResult =
    | { status: 'pending' }
    | { status: 'expired' }
    | { status: 'not_found' }
    | { status: 'claimed'; displayId: string }

/** Thrown by stores; actions map these codes to messages. */
export class StoreError extends Error {
    readonly code: 'NOT_FOUND' | 'CONFLICT' | 'LIMIT'
    constructor(code: 'NOT_FOUND' | 'CONFLICT' | 'LIMIT', message?: string) {
        super(message ?? code)
        this.name = 'StoreError'
        this.code = code
    }
}

/** A patch function returns the fields to change, or null to leave the record untouched. */
export type Mutator<T> = (current: T) => Partial<T> | null

/**
 * Persistence for every domain object. Every user-scoped method takes the owner uid
 * and treats records owned by someone else exactly like missing ones.
 */
export interface Store {
    readonly backend: 'firebase' | 'local'
    newId(): string

    listRecipeSummaries(uid: string): Promise<RecipeSummary[]>
    listRecipes(uid: string): Promise<RecipeRecord[]>
    getRecipe(uid: string, id: string): Promise<RecipeRecord | null>
    createRecipe(record: RecipeRecord): Promise<void>
    updateRecipe(uid: string, id: string, mutate: Mutator<RecipeRecord>): Promise<RecipeRecord>
    deleteRecipe(uid: string, id: string): Promise<RecipeRecord>

    listCollections(uid: string): Promise<CollectionRecord[]>
    getCollection(uid: string, id: string): Promise<CollectionRecord | null>
    createCollection(record: CollectionRecord): Promise<void>
    updateCollection(uid: string, id: string, mutate: Mutator<CollectionRecord>): Promise<CollectionRecord>
    /** Deletes the collection and removes it from every recipe that lists it. */
    deleteCollection(uid: string, id: string): Promise<void>
    /** Adds or removes recipes from a collection; ignores ids the user does not own. */
    setCollectionMembership(uid: string, collectionId: string, recipeIds: string[], member: boolean): Promise<number>

    getGroceryItems(uid: string): Promise<GroceryItem[]>
    updateGroceryItems(uid: string, mutate: (items: GroceryItem[]) => GroceryItem[]): Promise<GroceryItem[]>

    listDisplays(uid: string): Promise<DisplayRecord[]>
    /** Unscoped read for display-cookie auth; callers must verify the token hash. */
    getDisplay(id: string): Promise<DisplayRecord | null>
    findCastDisplay(uid: string, castDeviceId: string): Promise<DisplayRecord | null>
    createDisplay(record: DisplayRecord): Promise<void>
    updateDisplay(uid: string, id: string, mutate: Mutator<DisplayRecord>): Promise<DisplayRecord>
    /** Heartbeat from the display itself; no owner check, no version bump. */
    touchDisplay(id: string, at: number): Promise<void>
    deleteDisplay(uid: string, id: string): Promise<void>

    createPairing(record: PairingRecord): Promise<void>
    getPairing(id: string): Promise<PairingRecord | null>
    /** The newest pairing with this code that has not expired. */
    findActivePairing(code: string, now: number): Promise<PairingRecord | null>
    /** Atomically marks the pairing claimed and creates the display. */
    claimPairing(pairingId: string, display: DisplayRecord, now: number): Promise<ClaimPairingResult>
    /** Atomically hands a claimed pairing's display its token hash and deletes the pairing. */
    collectPairing(pairingId: string, pollTokenHash: string, displayTokenHash: string, now: number): Promise<CollectPairingResult>

    createClipDraft(record: ClipDraftRecord): Promise<void>
    getClipDraft(id: string, now: number): Promise<ClipDraftRecord | null>

    createCastToken(record: CastTokenRecord): Promise<void>
    /** Deletes the token and returns its owner when it exists and has not expired. */
    consumeCastToken(id: string, now: number): Promise<string | null>
}
