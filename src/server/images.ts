import 'server-only'

import { randomUUID } from 'node:crypto'
import { QuantizerCelebi, Score, argbFromRgb } from '@material/material-color-utilities'
import sharp, { type Sharp } from 'sharp'
import { adminBucket } from './firebase-admin'

/** Longest edge of the stored hero image. */
const IMAGE_MAX_EDGE = 1600
/** Longest edge of the stored list thumbnail. */
const THUMB_MAX_EDGE = 480
/** Downsample size for seed-color extraction. */
const SEED_SAMPLE_EDGE = 64

export interface ProcessedRecipeImage {
    image: Buffer
    thumbnail: Buffer
    seedColor: number
}

export interface StoredRecipeImage {
    imagePath: string
    thumbnailPath: string
    imageUrl: string
    thumbnailUrl: string
}

let bucketProbe: Promise<boolean> | null = null

/**
 * Whether Firebase Storage is usable on this project. Spark-plan projects
 * without a bucket fall back to inline base64 photos; once the user enables
 * Storage (Blaze) the next server instance picks it up automatically.
 * Probed once per instance.
 */
export function storageAvailable(): Promise<boolean> {
    bucketProbe ??= adminBucket()
        .exists()
        .then(([exists]) => exists)
        .catch(() => false)
    return bucketProbe
}

/** Inline caps keep every doc comfortably under Firestore's 1 MiB. */
const MAX_INLINE_IMAGE_BASE64 = 900 * 1024
const MAX_INLINE_THUMB_BASE64 = 48 * 1024

export interface InlineRecipeImage {
    /** base64 data URLs, ready to store on the doc. */
    image: string
    thumbnail: string
    seedColor: number
}

/** Clip drafts also carry recipe text in the same 1 MiB doc. */
const MAX_CLIP_IMAGE_BASE64 = 640 * 1024

type QualityLadder = Array<[edge: number, quality: number]>

const INLINE_IMAGE_LADDER: QualityLadder = [
    [1600, 80],
    [1280, 75],
    [1024, 70],
    [800, 60],
]
const INLINE_THUMB_LADDER: QualityLadder = [
    [480, 70],
    [320, 65],
    [240, 60],
    [160, 55],
]

/** Encodes WebP renditions down a quality ladder until the base64 fits. */
async function encodeInline(base: Sharp, maxBase64: number, ladder: QualityLadder): Promise<string> {
    for (const [edge, quality] of ladder) {
        const buf = await base
            .clone()
            .resize(edge, edge, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality })
            .toBuffer()
        const b64 = buf.toString('base64')
        if (b64.length <= maxBase64) return `data:image/webp;base64,${b64}`
    }
    throw new Error('unsupported image format: could not fit size limits')
}

function openImage(input: Buffer | ArrayBuffer | Uint8Array): Sharp {
    const source = Buffer.isBuffer(input) ? input : Buffer.from(input as ArrayBuffer)
    // .rotate() bakes in EXIF orientation; limitInputPixels guards decompression bombs.
    return sharp(source, { limitInputPixels: 64_000_000 }).rotate()
}

/**
 * Storage-less fallback: same sharp pipeline, but the renditions are written
 * inline on the doc as WebP data URLs. Quality-ladders down to fit the caps.
 */
export async function processInlineRecipeImage(input: Buffer | ArrayBuffer | Uint8Array): Promise<InlineRecipeImage> {
    const base = openImage(input)
    const [seedColor, image, thumbnail] = await Promise.all([
        extractSeedColor(base.clone()),
        encodeInline(base, MAX_INLINE_IMAGE_BASE64, INLINE_IMAGE_LADDER),
        encodeInline(base, MAX_INLINE_THUMB_BASE64, INLINE_THUMB_LADDER),
    ])
    return { image, thumbnail, seedColor }
}

/**
 * A clipped photo, re-encoded as one WebP data URL. Decoding with sharp is the
 * real content check; the bytes came from an untrusted site.
 */
export async function clipImageDataUrl(input: Uint8Array): Promise<string> {
    const base = openImage(input)
    const meta = await base.metadata()
    if (!meta.width || !meta.height || meta.width < 64 || meta.height < 64) {
        throw new Error('unsupported image format: too small')
    }
    return encodeInline(base, MAX_CLIP_IMAGE_BASE64, INLINE_IMAGE_LADDER)
}

/**
 * Turns an uploaded photo (any browser-supported format, any size within the
 * action body limit) into the two WebP renditions we store, plus the M3 seed
 * color extracted from its pixels (quantize + score, same algorithm Android
 * uses for wallpaper-based dynamic color).
 *
 * sharp rejects non-image payloads by content, so this also serves as
 * validation: never trust the uploaded MIME type.
 */
export async function processRecipeImage(input: Buffer | ArrayBuffer | Uint8Array): Promise<ProcessedRecipeImage> {
    const base = openImage(input)

    const [image, thumbnail, seedColor] = await Promise.all([
        base
            .clone()
            .resize(IMAGE_MAX_EDGE, IMAGE_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer(),
        base
            .clone()
            .resize(THUMB_MAX_EDGE, THUMB_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 70 })
            .toBuffer(),
        extractSeedColor(base.clone()),
    ])

    return { image, thumbnail, seedColor }
}

/** Extracts an M3 seed color (ARGB int) from image pixels. */
export async function extractSeedColor(pipeline: Sharp): Promise<number> {
    const { data, info } = await pipeline
        .resize(SEED_SAMPLE_EDGE, SEED_SAMPLE_EDGE, { fit: 'inside' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

    const pixels: number[] = []
    for (let i = 0; i + 2 < data.length; i += info.channels) {
        pixels.push(argbFromRgb(data[i] as number, data[i + 1] as number, data[i + 2] as number))
    }
    const ranked = Score.score(QuantizerCelebi.quantize(pixels, 128))
    // Score always returns at least one color (falls back to Google blue).
    return ranked[0] as number
}

/** Seed color from a legacy base64 data-URL image (backfill path). */
export async function seedColorFromDataUrl(dataUrl: string): Promise<number> {
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    return extractSeedColor(sharp(Buffer.from(base64, 'base64'), { limitInputPixels: 64_000_000 }))
}

function tokenUrl(bucketName: string, path: string, token: string): string {
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
}

/**
 * Uploads both renditions under users/{uid}/recipes/{recipeId}/ with fresh
 * Firebase download tokens and returns the stable capability URLs. Uploads
 * overwrite in place; a new token invalidates previously handed-out URLs.
 */
export async function storeRecipeImages(
    uid: string,
    recipeId: string,
    processed: Pick<ProcessedRecipeImage, 'image' | 'thumbnail'>,
): Promise<StoredRecipeImage> {
    const bucket = adminBucket()
    const prefix = `users/${uid}/recipes/${recipeId}`
    const imagePath = `${prefix}/image.webp`
    const thumbnailPath = `${prefix}/thumb.webp`

    const upload = async (path: string, contents: Buffer): Promise<string> => {
        const token = randomUUID()
        await bucket.file(path).save(contents, {
            resumable: false,
            metadata: {
                contentType: 'image/webp',
                cacheControl: 'private, max-age=3600',
                metadata: { firebaseStorageDownloadTokens: token },
            },
        })
        return tokenUrl(bucket.name, path, token)
    }

    const [imageUrl, thumbnailUrl] = await Promise.all([
        upload(imagePath, processed.image),
        upload(thumbnailPath, processed.thumbnail),
    ])

    return { imagePath, thumbnailPath, imageUrl, thumbnailUrl }
}

/** Removes every stored object for a recipe. Safe to call when none exist. */
export async function deleteRecipeImages(uid: string, recipeId: string): Promise<void> {
    await adminBucket().deleteFiles({ prefix: `users/${uid}/recipes/${recipeId}/` })
}
