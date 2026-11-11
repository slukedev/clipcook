import 'server-only'

import type { DocumentSnapshot } from 'firebase-admin/firestore'
import {
    byteLength,
    dataUrlLength,
    estimateRecipeBytes,
    FILE_TAIL,
    fileHead,
    HARD_PART_BYTES,
    inRange,
    MAX_IMAGE_CHARS,
    mapLegacyRecipe,
    type PhotoSource,
    type PlannedPart,
    photoSourceOf,
    planParts,
    toPhotoDataUrl,
} from '@/lib/legacy-export'
import { adminBucket, adminDb } from './firebase-admin'

const COLLECTION = 'allRecipes'
/** Docs fetched per round trip; inline photos can be ~900 KB each. */
const BATCH = 20
/** Largest Storage object worth embedding (its data URL must stay under 12 MiB). */
const MAX_PHOTO_BYTES = Math.floor(((MAX_IMAGE_CHARS - 64) * 3) / 4)

function bucketName(): string | undefined {
    return process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined
}

/** The user's recipe ids, sorted, without reading any recipe bodies. */
async function recipeIds(uid: string): Promise<string[]> {
    const snap = await adminDb().collection(COLLECTION).where('uid', '==', uid).select().get()
    return snap.docs.map((d) => d.id).sort()
}

/** Yields the user's docs in small batches so photos never pile up in memory. */
async function* recipeBatches(uid: string, ids: string[]): AsyncGenerator<DocumentSnapshot[]> {
    const col = adminDb().collection(COLLECTION)
    for (let i = 0; i < ids.length; i += BATCH) {
        const refs = ids.slice(i, i + BATCH).map((id) => col.doc(id))
        if (refs.length === 0) continue
        const snaps = await adminDb().getAll(...refs)
        // Re-check ownership on the full doc, not just the query.
        yield snaps.filter((snap) => snap.exists && snap.get('uid') === uid)
    }
}

function storageFile(path: string) {
    // Old uploads all live under users/{uid}/; never read outside the owner's folder.
    return adminBucket().file(path)
}

function ownsPath(uid: string, path: string): boolean {
    return path.startsWith(`users/${uid}/`) && !path.includes('..')
}

/** Length of the photo's data URL once embedded, without downloading it. */
async function photoChars(uid: string, photo: PhotoSource): Promise<number> {
    switch (photo.kind) {
        case 'none':
            return 0
        case 'inline':
            return photo.dataUrl.length <= MAX_IMAGE_CHARS ? photo.dataUrl.length : 0
        case 'link':
            return photo.url.length
        case 'storage': {
            if (!ownsPath(uid, photo.path)) return 0
            try {
                const [meta] = await storageFile(photo.path).getMetadata()
                const size = Number(meta.size ?? 0)
                return size > 0 && size <= MAX_PHOTO_BYTES ? dataUrlLength(meta.contentType, size) : 0
            } catch {
                return 0
            }
        }
    }
}

/** The photo as the import file stores it: a data URL, an https link, or ''. */
async function photoValue(uid: string, photo: PhotoSource): Promise<string> {
    switch (photo.kind) {
        case 'none':
            return ''
        case 'inline':
            return photo.dataUrl
        case 'link':
            return photo.url
        case 'storage': {
            if (!ownsPath(uid, photo.path)) return ''
            try {
                const file = storageFile(photo.path)
                const [meta] = await file.getMetadata()
                if (Number(meta.size ?? 0) > MAX_PHOTO_BYTES) return ''
                const [bytes] = await file.download()
                return toPhotoDataUrl(meta.contentType, bytes)
            } catch {
                // A missing photo should not sink the export.
                return ''
            }
        }
    }
}

export interface ExportPlan {
    total: number
    parts: PlannedPart[]
}

/** Works out how to split the user's recipes into import-sized files. */
export async function planExport(uid: string): Promise<ExportPlan> {
    const ids = await recipeIds(uid)
    const bucket = bucketName()
    const entries: Array<{ id: string; bytes: number }> = []
    for await (const docs of recipeBatches(uid, ids)) {
        const sized = await Promise.all(
            docs.map(async (doc) => {
                const data = doc.data() ?? {}
                const recipe = mapLegacyRecipe(doc.id, data, '')
                if (!recipe) return null
                const chars = await photoChars(uid, photoSourceOf(data, bucket))
                return { id: doc.id, bytes: estimateRecipeBytes(recipe, chars) }
            }),
        )
        for (const entry of sized) if (entry) entries.push(entry)
    }
    return { total: entries.length, parts: planParts(entries) }
}

/**
 * Streams one part of the export: every recipe of the user whose id is in
 * [from, to). Photos are embedded as data URLs, as in scripts/export-legacy.mjs.
 */
export function exportPartStream(uid: string, from: string, to: string | null, now = new Date()) {
    const encoder = new TextEncoder()
    return new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                const bucket = bucketName()
                const ids = (await recipeIds(uid)).filter((id) => inRange(id, from, to))
                const head = fileHead(now.toISOString())
                let written = byteLength(head) + byteLength(FILE_TAIL)
                let count = 0
                controller.enqueue(encoder.encode(head))
                for await (const docs of recipeBatches(uid, ids)) {
                    // Photos for a batch download in parallel; output keeps id order.
                    const mapped = await Promise.all(
                        docs.map(async (doc) => {
                            const data = doc.data() ?? {}
                            const bare = mapLegacyRecipe(doc.id, data, '')
                            if (!bare) return null
                            return { bare, image: await photoValue(uid, photoSourceOf(data, bucket)) }
                        }),
                    )
                    for (const item of mapped) {
                        if (!item) continue
                        let { image } = item
                        // Stay under the importer's limit even if photos grew since planning.
                        if (written + estimateRecipeBytes(item.bare, image.length) > HARD_PART_BYTES) image = ''
                        const chunk = `${count ? ',' : ''}\n${JSON.stringify({ ...item.bare, image })}`
                        written += byteLength(chunk)
                        count += 1
                        controller.enqueue(encoder.encode(chunk))
                    }
                }
                controller.enqueue(encoder.encode(FILE_TAIL))
                controller.close()
            } catch (err) {
                controller.error(err)
            }
        },
    })
}
