import { z } from 'zod'

const MAX_STRING = 2000
const MAX_LONG_STRING = 10_000
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB base64 payload limit

const dataUrlImage = z
    .string()
    .min(1, 'Image is required')
    .max(MAX_IMAGE_BYTES, 'Image is too large (max 5 MB)')
    .refine(
        (v) => /^data:image\/(png|jpe?g|webp|gif|avif);base64,/i.test(v),
        'Image must be a base64 PNG, JPEG, WebP, GIF, or AVIF',
    )

const shortText = z.string().trim().min(1).max(MAX_STRING)
const longText = z.string().trim().max(MAX_LONG_STRING)
const tinyText = z.string().trim().min(1).max(200)

export const recipeInputSchema = z.object({
    image: dataUrlImage,
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
