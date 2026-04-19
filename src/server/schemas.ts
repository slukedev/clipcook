import { z } from 'zod'

const MAX_STRING = 2000
const MAX_LONG_STRING = 10_000
// Firestore caps documents at ~1 MiB. Reserve headroom for every other field (title,
// description, notes, arrays) so the doc stays well under the limit when encoded.
const MAX_IMAGE_BYTES = 900 * 1024 // base64 chars, ≈ 675 KB raw image
const MAX_THUMB_BYTES = 48 * 1024 // base64 chars, ≈ 36 KB raw thumbnail

const dataUrlImage = z
    .string()
    .min(1, 'Image is required')
    .max(MAX_IMAGE_BYTES, 'Image is too large — please pick a smaller photo.')
    .refine(
        (v) => /^data:image\/(png|jpe?g|webp|gif|avif);base64,/i.test(v),
        'Image must be a base64 PNG, JPEG, WebP, GIF, or AVIF',
    )

const dataUrlThumb = z
    .string()
    .max(MAX_THUMB_BYTES)
    .refine(
        (v) => v === '' || /^data:image\/(png|jpe?g|webp);base64,/i.test(v),
        'Thumbnail must be a base64 PNG, JPEG, or WebP',
    )
    .default('')

const shortText = z.string().trim().min(1).max(MAX_STRING)
const longText = z.string().trim().max(MAX_LONG_STRING)
const tinyText = z.string().trim().min(1).max(200)

export const recipeInputSchema = z.object({
    image: dataUrlImage,
    thumbnail: dataUrlThumb,
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

export type RecipeInput = z.infer<typeof recipeInputSchema>

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
