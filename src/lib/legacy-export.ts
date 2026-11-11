/**
 * Maps `allRecipes` docs into the new ClipCook import format
 * (`clipcook.export.v1`, read by Settings > Import in the new app).
 *
 * Same field mapping as the new repo's scripts/export-legacy.mjs, with values
 * clamped to the new importer's limits so one long field never fails a file.
 * Pure: no Firebase imports, so it can be checked without a database.
 */

export const EXPORT_SCHEMA = 'clipcook.export.v1'
/** The new importer rejects files over 25 MB; parts aim well under that. */
export const MAX_PART_BYTES = 20 * 1024 * 1024
/** Hard ceiling while streaming a part, in case photos grew since planning. */
export const HARD_PART_BYTES = 24 * 1024 * 1024
/** The new importer takes at most 2000 recipes per file. */
export const MAX_PART_RECIPES = 2000
/** The new importer drops image strings longer than 12 MiB. */
export const MAX_IMAGE_CHARS = 12 * 1024 * 1024

const LIMITS = { title: 200, shortText: 2000, longText: 10_000, lines: 300, timeText: 60, servings: 40, url: 2048 }
const PHOTO_TYPES = /^image\/(png|jpe?g|webp|gif|avif)$/i
const DATA_URL = /^data:image\/(png|jpe?g|webp|gif|avif);base64,/i

export interface ExportRecipe {
    id: string
    title: string
    description: string
    servings: string
    prepTime: string
    cookTime: string
    totalTime: string
    ingredients: string[]
    instructions: string[]
    notes: string
    image: string
    tags: string[]
    sourceUrl: string | null
    createdAt?: number
}

/** Where a doc's photo lives. */
export type PhotoSource =
    | { kind: 'none' }
    | { kind: 'inline'; dataUrl: string }
    | { kind: 'storage'; path: string }
    | { kind: 'link'; url: string }

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const clip = (v: unknown, max: number): string => str(v).slice(0, max)
const lines = (v: unknown, max = LIMITS.lines): string[] =>
    Array.isArray(v)
        ? v
              .map(str)
              .map((s) => s.trim().slice(0, LIMITS.shortText))
              .filter(Boolean)
              .slice(0, max)
        : []

function millis(v: unknown): number | undefined {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (v && typeof v === 'object' && 'toMillis' in v && typeof v.toMillis === 'function') {
        const ms = v.toMillis()
        return typeof ms === 'number' && Number.isFinite(ms) ? ms : undefined
    }
    return undefined
}

function httpsUrl(v: string): string | null {
    if (!v || v.length > LIMITS.url) return null
    try {
        return new URL(v).protocol === 'https:' ? v : null
    } catch {
        return null
    }
}

/** Storage object path from a Firebase download URL in the given bucket. */
function storagePathFromUrl(url: string, bucket: string | undefined): string | null {
    if (!bucket) return null
    try {
        const u = new URL(url)
        if (u.hostname !== 'firebasestorage.googleapis.com') return null
        const match = u.pathname.match(/^\/v0\/b\/([^/]+)\/o\/([^/]+)$/)
        if (!match || decodeURIComponent(match[1] as string) !== bucket) return null
        return decodeURIComponent(match[2] as string)
    } catch {
        return null
    }
}

/**
 * Old docs hold the photo inline (`image` as a data URL) or in Storage
 * (`imagePath` + `imageUrl`). Anything else is passed through as an https link.
 */
export function photoSourceOf(data: Record<string, unknown>, bucket?: string): PhotoSource {
    const image = str(data.image)
    if (DATA_URL.test(image)) return { kind: 'inline', dataUrl: image }
    const path = str(data.imagePath)
    if (path) return { kind: 'storage', path }
    const url = str(data.imageUrl) || (image.startsWith('https://') ? image : '')
    if (!url) return { kind: 'none' }
    const fromUrl = storagePathFromUrl(url, bucket)
    if (fromUrl) return { kind: 'storage', path: fromUrl }
    const link = httpsUrl(url)
    return link ? { kind: 'link', url: link } : { kind: 'none' }
}

/** Builds a data URL the new importer will store, or '' when it would not. */
export function toPhotoDataUrl(contentType: string | undefined, bytes: Uint8Array): string {
    const type = (contentType ?? '').split(';')[0]?.trim().toLowerCase() || 'image/jpeg'
    if (!PHOTO_TYPES.test(type)) return ''
    const dataUrl = `data:${type};base64,${Buffer.from(bytes).toString('base64')}`
    return dataUrl.length <= MAX_IMAGE_CHARS ? dataUrl : ''
}

/** Length of the data URL a Storage object of `size` bytes becomes. */
export function dataUrlLength(contentType: string | undefined, size: number): number {
    const type = (contentType ?? '').split(';')[0]?.trim() || 'image/jpeg'
    return `data:${type};base64,`.length + 4 * Math.ceil(size / 3)
}

/** Maps one old doc to an import recipe. Returns null for docs the importer would reject. */
export function mapLegacyRecipe(id: string, data: Record<string, unknown>, image: string): ExportRecipe | null {
    const title = str(data.title).trim().slice(0, LIMITS.title).trim()
    if (!title) return null
    const recipe: ExportRecipe = {
        id: id.slice(0, 128),
        title,
        description: clip(data.description, LIMITS.shortText),
        servings: clip(data.servings, LIMITS.servings),
        prepTime: clip(data.prepTime, LIMITS.timeText),
        cookTime: clip(data.cookTime, LIMITS.timeText),
        totalTime: clip(data.totalTime, LIMITS.timeText),
        ingredients: lines(data.ingredients),
        instructions: lines(data.instructions),
        notes: clip(data.notes, LIMITS.longText),
        image: image.length <= MAX_IMAGE_CHARS ? image : '',
        tags: lines(data.tags, 40),
        sourceUrl: httpsUrl(str(data.sourceUrl)),
    }
    const createdAt = millis(data.createdAt)
    if (createdAt !== undefined) recipe.createdAt = createdAt
    return recipe
}

const encoder = new TextEncoder()
export const byteLength = (s: string): number => encoder.encode(s).length

/** Bytes a recipe adds to a file once its photo of `imageChars` is embedded. */
export function estimateRecipeBytes(recipe: ExportRecipe, imageChars: number): number {
    // Base64 and data-URL prefixes are ASCII, so chars equal bytes.
    return byteLength(JSON.stringify({ ...recipe, image: '' })) + imageChars + 2
}

export interface PlannedPart {
    part: number
    /** First doc id in this part (inclusive). */
    from: string
    /** First doc id of the next part (exclusive), or null for the last part. */
    to: string | null
    recipes: number
    bytes: number
}

/**
 * Splits recipes (sorted by id) into contiguous id ranges under the byte and
 * count limits. Ranges, not indexes, so a part request stays correct even if
 * photo sizes or the library change between planning and download.
 */
export function planParts(
    entries: ReadonlyArray<{ id: string; bytes: number }>,
    maxBytes = MAX_PART_BYTES,
    maxRecipes = MAX_PART_RECIPES,
): PlannedPart[] {
    const sorted = [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const parts: PlannedPart[] = []
    let current: PlannedPart | null = null
    for (const entry of sorted) {
        if (current && (current.bytes + entry.bytes > maxBytes || current.recipes >= maxRecipes)) {
            current.to = entry.id
            current = null
        }
        if (!current) {
            current = { part: parts.length + 1, from: entry.id, to: null, recipes: 0, bytes: 0 }
            parts.push(current)
        }
        current.recipes += 1
        current.bytes += entry.bytes
    }
    return parts
}

export function inRange(id: string, from: string, to: string | null): boolean {
    return id >= from && (to === null || id < to)
}

/** JSON text before the recipes array. */
export function fileHead(exportedAt: string): string {
    return `{"schema":${JSON.stringify(EXPORT_SCHEMA)},"exportedAt":${JSON.stringify(exportedAt)},"recipes":[`
}

/** JSON text after the recipes array. The old app has no collections or grocery list. */
export const FILE_TAIL = '\n],"collections":[],"grocery":[]}\n'
