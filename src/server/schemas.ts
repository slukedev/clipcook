import { z } from 'zod'
import { LIMITS } from '@/lib/domain/types'

const MAX_DATA_URL = 8 * 1024 * 1024
/** Client pre-resizes to ~2560px; this bounds a raw upload that skipped it. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

export const idSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid id')

export const recipeIdSchema = idSchema

const line = z.string().max(LIMITS.shortText)

function lines(max = LIMITS.lines) {
    return z
        .array(line)
        .max(max, 'Too many lines.')
        .transform((values) => values.map((v) => v.replace(/\s+/g, ' ').trim()).filter(Boolean))
}

export const httpUrlSchema = z
    .string()
    .trim()
    .max(2048)
    .refine((u) => {
        try {
            const parsed = new URL(u)
            return parsed.protocol === 'http:' || parsed.protocol === 'https:'
        } catch {
            return false
        }
    }, 'Enter a full web address.')

export const importUrlSchema = httpUrlSchema

export const tagsSchema = z.array(z.string().max(LIMITS.tagLength * 2)).max(LIMITS.tags * 2)

export const recipeInputSchema = z.object({
    title: z.string().trim().min(1, 'Add a title.').max(LIMITS.title),
    description: z.string().trim().max(LIMITS.shortText).default(''),
    servings: z.string().trim().max(40).default(''),
    prepTime: z.string().trim().max(60).default(''),
    cookTime: z.string().trim().max(60).default(''),
    totalTime: z.string().trim().max(60).default(''),
    notes: z.string().trim().max(LIMITS.longText).default(''),
    ingredients: lines().default([]),
    instructions: lines().default([]),
    tags: tagsSchema.default([]),
    collectionIds: z.array(idSchema).max(LIMITS.collections).default([]),
    favorite: z.boolean().default(false),
    sourceUrl: httpUrlSchema.nullable().default(null),
    sourceName: z.string().trim().max(200).nullable().default(null),
})

export type RecipeInput = z.infer<typeof recipeInputSchema>

/** The photo a save should end up with. */
export type PhotoChange =
    | { kind: 'file'; file: File }
    | { kind: 'dataUrl'; dataUrl: string }
    | { kind: 'keep' }
    | { kind: 'remove' }

const dataUrlPhoto = z
    .string()
    .max(MAX_DATA_URL, 'That photo is too large. Pick a smaller one.')
    .refine((v) => /^data:image\/(png|jpe?g|webp|gif|avif);base64,/i.test(v), 'That image format is not supported.')

/** A JSON array, or one entry per line. */
function readLines(value: FormDataEntryValue | null): unknown {
    if (typeof value !== 'string' || value.trim() === '') return []
    const trimmed = value.trim()
    if (trimmed.startsWith('[')) {
        try {
            return JSON.parse(trimmed)
        } catch {
            return null
        }
    }
    return trimmed.split(/\r?\n/)
}

function readOptional(formData: FormData, key: string): string | undefined {
    const v = formData.get(key)
    return typeof v === 'string' ? v : undefined
}

/**
 * Reads the recipe editor's FormData. Text fields are plain entries; `ingredients`,
 * `instructions`, `tags`, and `collectionIds` are JSON arrays (or newline text);
 * the photo is a `photo` File, a `photoDataUrl` string, or `removePhoto=1`.
 */
export function parseRecipeFormData(
    formData: FormData,
): { ok: true; input: RecipeInput; photo: PhotoChange } | { ok: false; error: string } {
    const sourceUrl = readOptional(formData, 'sourceUrl')?.trim()
    const sourceName = readOptional(formData, 'sourceName')?.trim()
    const favorite = readOptional(formData, 'favorite')
    const parsed = recipeInputSchema.safeParse({
        title: readOptional(formData, 'title') ?? '',
        description: readOptional(formData, 'description'),
        servings: readOptional(formData, 'servings'),
        prepTime: readOptional(formData, 'prepTime'),
        cookTime: readOptional(formData, 'cookTime'),
        totalTime: readOptional(formData, 'totalTime'),
        notes: readOptional(formData, 'notes'),
        ingredients: readLines(formData.get('ingredients')),
        instructions: readLines(formData.get('instructions')),
        tags: readLines(formData.get('tags')),
        collectionIds: readLines(formData.get('collectionIds')),
        favorite: favorite === undefined ? undefined : favorite === 'true' || favorite === '1' || favorite === 'on',
        sourceUrl: sourceUrl ? sourceUrl : null,
        sourceName: sourceName ? sourceName : null,
    })
    if (!parsed.success)
        return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the recipe and try again.' }

    const photoEntry = formData.get('photo')
    if (photoEntry instanceof File && photoEntry.size > 0) {
        if (photoEntry.size > MAX_PHOTO_BYTES)
            return { ok: false, error: 'That photo is too large. Pick a smaller one.' }
        return { ok: true, input: parsed.data, photo: { kind: 'file', file: photoEntry } }
    }
    const dataUrl = formData.get('photoDataUrl')
    if (typeof dataUrl === 'string' && dataUrl.length > 0) {
        const checked = dataUrlPhoto.safeParse(dataUrl)
        if (!checked.success)
            return { ok: false, error: checked.error.issues[0]?.message ?? 'That image could not be used.' }
        return { ok: true, input: parsed.data, photo: { kind: 'dataUrl', dataUrl: checked.data } }
    }
    const remove = formData.get('removePhoto')
    if (remove === '1' || remove === 'true') return { ok: true, input: parsed.data, photo: { kind: 'remove' } }
    return { ok: true, input: parsed.data, photo: { kind: 'keep' } }
}

export const displayNameSchema = z.string().trim().min(1, 'Add a name.').max(LIMITS.displayName)

export const displayContentSchema = z.object({
    recipeId: idSchema,
    step: z.number().int().min(0).max(1000).nullable().default(null),
    scale: z.number().positive().max(100).default(1),
})

export const collectionNameSchema = z.string().trim().min(1, 'Add a name.').max(LIMITS.collectionName)
