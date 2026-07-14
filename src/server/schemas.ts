import { z } from 'zod'

const MAX_STRING = 2000
const MAX_LONG_STRING = 10_000
// Legacy docs store the photo inline as base64 (Firestore caps docs at ~1 MiB).
// New writes keep photos in Storage; these caps still bound legacy payloads and
// the autoimport → save passthrough.
const MAX_DATA_URL = 8 * 1024 * 1024
/** Client pre-resizes to ~2560px; this bounds a raw upload that skipped it. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

const shortText = z.string().trim().min(1).max(MAX_STRING)
const longText = z.string().trim().max(MAX_LONG_STRING)
const tinyText = z.string().trim().min(1).max(200)

const dataUrlPhoto = z
    .string()
    .max(MAX_DATA_URL, 'Image is too large — please pick a smaller photo.')
    .refine(
        (v) => /^data:image\/(png|jpe?g|webp|gif|avif);base64,/i.test(v),
        'Image must be a base64 PNG, JPEG, WebP, GIF, or AVIF',
    )

/** The text fields of a recipe (photo travels separately). */
export const recipeFieldsSchema = z.object({
    title: tinyText,
    description: shortText,
    servings: z.union([z.string().trim().min(1).max(20), z.number().int().positive()]),
    prepTime: tinyText,
    cookTime: tinyText,
    totalTime: tinyText,
    notes: longText.default(''),
    ingredients: z.array(shortText).min(1).max(100),
    instructions: z.array(shortText).min(1).max(100),
})

export type RecipeFields = z.infer<typeof recipeFieldsSchema>

/**
 * Parses the FormData a create/update action receives. The photo arrives as
 * either a `photo` File (picker upload) or a `photoDataUrl` string
 * (autoimported image passed through the form). Both are optional on update.
 */
export function parseRecipeFormData(
    formData: FormData,
): { ok: true; fields: RecipeFields; photo: File | null; photoDataUrl: string | null } | { ok: false; error: string } {
    let ingredients: unknown
    let instructions: unknown
    try {
        ingredients = JSON.parse(String(formData.get('ingredients') ?? '[]'))
        instructions = JSON.parse(String(formData.get('instructions') ?? '[]'))
    } catch {
        return { ok: false, error: 'Invalid recipe data.' }
    }

    const servingsRaw = String(formData.get('servings') ?? '')
    const parsed = recipeFieldsSchema.safeParse({
        title: formData.get('title'),
        description: formData.get('description'),
        servings: servingsRaw,
        prepTime: formData.get('prepTime'),
        cookTime: formData.get('cookTime'),
        totalTime: formData.get('totalTime'),
        notes: formData.get('notes') ?? '',
        ingredients,
        instructions,
    })
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid recipe.' }
    }

    const photoEntry = formData.get('photo')
    const photo = photoEntry instanceof File && photoEntry.size > 0 ? photoEntry : null
    if (photo && photo.size > MAX_PHOTO_BYTES) {
        return { ok: false, error: 'Image is too large — please pick a smaller photo.' }
    }

    const dataUrlRaw = formData.get('photoDataUrl')
    let photoDataUrl: string | null = null
    if (typeof dataUrlRaw === 'string' && dataUrlRaw.length > 0) {
        const checked = dataUrlPhoto.safeParse(dataUrlRaw)
        if (!checked.success) {
            return { ok: false, error: checked.error.issues[0]?.message ?? 'Invalid image.' }
        }
        photoDataUrl = checked.data
    }

    return { ok: true, fields: parsed.data, photo, photoDataUrl }
}

export const importUrlSchema = z
    .string()
    .trim()
    .url('Must be a valid URL')
    .max(2048)
    .refine((u) => {
        try {
            const parsed = new URL(u)
            return parsed.protocol === 'http:' || parsed.protocol === 'https:'
        } catch {
            return false
        }
    }, 'Only http(s) URLs are allowed')

export const recipeIdSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid recipe id')
