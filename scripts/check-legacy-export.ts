// Checks the legacy export mapping against the NEW app's import parser, with
// fixture docs and no database. Run: npm run check:export
//
// The schema below is copied verbatim from the new app (slukedev/clipcook master
// 6350249, src/server/data-transfer.ts `exportSchema` + `parseExport`, with LIMITS
// and EXPORT_SCHEMA from src/lib/domain/types.ts and MAX_GROCERY_ITEMS from
// src/lib/recipe/grocery.ts). Re-copy it if the new importer changes.

import assert from 'node:assert/strict'
import { z } from 'zod'
import {
    FILE_TAIL,
    fileHead,
    HARD_PART_BYTES,
    inRange,
    MAX_PART_BYTES,
    mapLegacyRecipe,
    photoSourceOf,
    planParts,
    toPhotoDataUrl,
} from '../src/lib/legacy-export'

// ── Copied from the new app ────────────────────────────────────────────────
const EXPORT_SCHEMA = 'clipcook.export.v1' as const
const LIMITS = {
    title: 200,
    shortText: 2000,
    longText: 10_000,
    lines: 300,
    tags: 20,
    tagLength: 40,
    collectionName: 60,
    collections: 200,
    groceryItems: 500,
    displayName: 40,
    displays: 20,
} as const
const MAX_GROCERY_ITEMS = 500
const MAX_IMPORT_BYTES = 25 * 1024 * 1024
const MAX_IMPORT_RECIPES = 2000

const str = (max: number) => z.string().max(max).catch('')
const nullableNumber = z.number().finite().nullable().catch(null)
const lineArray = z
    .array(z.string().max(LIMITS.shortText))
    .max(LIMITS.lines)
    .catch([])
    .transform((v) => v.map((s) => s.trim()).filter(Boolean))

const importedRecipeSchema = z.object({
    id: z.string().max(128).optional(),
    title: z.string().trim().min(1).max(LIMITS.title),
    description: str(LIMITS.shortText).default(''),
    servings: z.union([z.string(), z.number()]).transform(String).pipe(z.string().max(40)).catch('').default(''),
    prepTime: str(60).default(''),
    cookTime: str(60).default(''),
    totalTime: str(60).default(''),
    ingredients: lineArray.default([]),
    instructions: lineArray.default([]),
    notes: str(LIMITS.longText).default(''),
    image: z
        .string()
        .max(12 * 1024 * 1024)
        .catch('')
        .default(''),
    tags: z.array(z.string()).catch([]).default([]),
    collectionIds: z.array(z.string().max(128)).max(LIMITS.collections).catch([]).default([]),
    favorite: z.boolean().catch(false).default(false),
    sourceUrl: z.string().url().max(2048).nullable().catch(null).default(null),
    sourceName: z.string().max(200).nullable().catch(null).default(null),
    cookCount: z.number().int().min(0).catch(0).default(0),
    lastCookedAt: nullableNumber.default(null),
    createdAt: z.number().finite().optional().catch(undefined),
})

const exportSchema = z.object({
    schema: z.literal(EXPORT_SCHEMA),
    recipes: z
        .array(importedRecipeSchema)
        .max(MAX_IMPORT_RECIPES, `Imports are limited to ${MAX_IMPORT_RECIPES} recipes.`),
    collections: z
        .array(z.object({ id: z.string().max(128), name: z.string().trim().min(1).max(LIMITS.collectionName) }))
        .max(LIMITS.collections)
        .catch([])
        .default([]),
    grocery: z
        .array(
            z.object({
                text: z.string().trim().min(1).max(LIMITS.shortText),
                checked: z.boolean().catch(false).default(false),
            }),
        )
        .max(MAX_GROCERY_ITEMS)
        .catch([])
        .default([]),
})

class ImportError extends Error {}

function parseExport(text: string) {
    let json: unknown
    try {
        json = JSON.parse(text)
    } catch {
        throw new ImportError('That file is not a ClipCook export.')
    }
    const parsed = exportSchema.safeParse(json)
    if (!parsed.success) {
        const issue = parsed.error.issues[0]
        throw new ImportError(
            issue?.path[0] === 'schema'
                ? 'That file is not a ClipCook export.'
                : (issue?.message ?? 'That file could not be read.'),
        )
    }
    return parsed.data
}
// The new importer embeds a photo only when it matches this (importExport in data-transfer.ts).
const IMPORTED_PHOTO = /^data:image\/(png|jpe?g|webp|gif|avif);base64,/i
// ── End of copy ────────────────────────────────────────────────────────────

// 1×1 PNG.
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
)
const inlinePhoto = `data:image/jpeg;base64,${PNG.toString('base64')}`
const timestamp = (ms: number) => ({ toMillis: () => ms, seconds: Math.floor(ms / 1000), nanoseconds: 0 })
const UID = 'user-a'
const BUCKET = 'old-project.appspot.com'

// Shapes the old app wrote to allRecipes.
const fixtures: Array<{ id: string; data: Record<string, unknown>; storageBytes?: Buffer }> = [
    {
        // Legacy doc: inline base64 photo, numeric servings, numeric timestamps.
        id: 'A1legacyInline',
        data: {
            uid: UID,
            title: 'Grandma’s Chili',
            description: 'Smoky and slow.',
            servings: 6,
            prepTime: '20 min',
            cookTime: '2 hr',
            totalTime: '2 hr 20 min',
            ingredients: ['2 lb beef', '  ', '1 onion, diced'],
            instructions: ['Brown the beef.', 'Simmer for 2 hours.'],
            notes: 'Better the next day.',
            image: inlinePhoto,
            thumbnail: inlinePhoto,
            seedColor: -12345,
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_100_000,
        },
    },
    {
        // Newer doc: photo in Storage (image/thumbnail cleared, path + token URL set).
        id: 'B2storagePhoto',
        data: {
            uid: UID,
            title: 'Weeknight Pad Thai',
            description: 'Fast noodles.',
            servings: '4',
            prepTime: '15 min',
            cookTime: '10 min',
            totalTime: '25 min',
            ingredients: ['8 oz rice noodles', '2 eggs'],
            instructions: ['Soak noodles.', 'Stir fry.'],
            notes: '',
            image: '',
            thumbnail: '',
            imagePath: `users/${UID}/recipes/B2storagePhoto/image.webp`,
            thumbnailPath: `users/${UID}/recipes/B2storagePhoto/thumb.webp`,
            imageUrl: `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/users%2F${UID}%2Frecipes%2FB2storagePhoto%2Fimage.webp?alt=media&token=t`,
            seedColor: 42,
            createdAt: 1_710_000_000_000,
        },
        storageBytes: PNG,
    },
    {
        // Odd doc: missing fields, Timestamp createdAt, over-long title and lines,
        // non-https source URL, too many ingredient lines.
        id: 'C3messy',
        data: {
            uid: UID,
            title: `  ${'Very long title '.repeat(20)}  `,
            ingredients: Array.from({ length: 350 }, (_, i) => `item ${i} ${'x'.repeat(i === 0 ? 2500 : 0)}`),
            instructions: 'not an array',
            sourceUrl: 'http://example.com/recipe',
            tags: ['dinner', 7, null],
            createdAt: timestamp(1_720_000_000_000),
        },
    },
    {
        // Untitled doc: the importer requires a title, so it is skipped.
        id: 'D4untitled',
        data: { uid: UID, title: '   ', ingredients: ['salt'] },
    },
]

const results = []
for (const f of fixtures) {
    const source = photoSourceOf(f.data, BUCKET)
    let image = ''
    if (source.kind === 'inline') image = source.dataUrl
    if (source.kind === 'storage') {
        assert.equal(source.path, f.data.imagePath)
        image = toPhotoDataUrl('image/webp', f.storageBytes as Buffer)
    }
    results.push(mapLegacyRecipe(f.id, f.data, image))
}
assert.equal(results[3], null, 'untitled doc is skipped')
const recipes = results.filter((r) => r !== null)

// Assemble the file exactly the way exportPartStream does.
let text = fileHead('2026-11-11T00:00:00.000Z')
recipes.forEach((r, i) => {
    text += `${i ? ',' : ''}\n${JSON.stringify(r)}`
})
text += FILE_TAIL

const parsed = parseExport(text)
assert.equal(parsed.recipes.length, 3)
const [chili, padThai, messy] = parsed.recipes
assert.ok(chili && padThai && messy)
assert.equal(chili.title, 'Grandma’s Chili')
assert.equal(chili.servings, '6')
assert.deepEqual(chili.ingredients, ['2 lb beef', '1 onion, diced'])
assert.equal(chili.createdAt, 1_700_000_000_000)
assert.match(chili.image, IMPORTED_PHOTO)
assert.match(padThai.image, /^data:image\/webp;base64,/)
assert.equal(Buffer.from(padThai.image.split(',')[1] as string, 'base64').equals(PNG), true)
assert.equal(messy.title.length <= 200, true)
assert.equal(messy.ingredients.length, 300, 'ingredients kept (clamped to 300), not dropped')
assert.equal(messy.ingredients[0]?.length, 2000)
assert.deepEqual(messy.instructions, [])
assert.equal(messy.sourceUrl, null)
assert.deepEqual(messy.tags, ['dinner', '7'])
assert.equal(messy.createdAt, 1_720_000_000_000)
assert.ok(Buffer.byteLength(text) < MAX_IMPORT_BYTES)

// The copied parser is strict: the unclamped title would have failed the whole file.
assert.throws(
    () => parseExport(text.replace(messy.title, 'x'.repeat(201))),
    ImportError,
    'an over-long title fails the import, which is why the mapping clamps it',
)
assert.throws(() => parseExport('{"schema":"other","recipes":[]}'), /not a ClipCook export/)

// Photo sources and the importer's photo filter.
assert.deepEqual(photoSourceOf({ imageUrl: fixtures[1]?.data.imageUrl }, BUCKET), {
    kind: 'storage',
    path: `users/${UID}/recipes/B2storagePhoto/image.webp`,
})
assert.equal(toPhotoDataUrl('image/svg+xml', PNG), '', 'unsupported types are not embedded')
assert.equal(toPhotoDataUrl('image/png', Buffer.alloc(10 * 1024 * 1024)), '', 'oversized photos are not embedded')

// Splitting: 25 recipes of ~1.5 MB each must split into parts of ≤ 20 MB.
const big = Array.from({ length: 25 }, (_, i) => ({ id: `r${String(i).padStart(3, '0')}`, bytes: 1_500_000 }))
const parts = planParts(big)
assert.equal(parts.length, 2)
for (const p of parts) assert.ok(p.bytes <= MAX_PART_BYTES)
assert.ok(MAX_PART_BYTES < HARD_PART_BYTES && HARD_PART_BYTES < MAX_IMPORT_BYTES)
for (const e of big) {
    assert.equal(parts.filter((p) => inRange(e.id, p.from, p.to)).length, 1, `${e.id} is in exactly one part`)
}
assert.equal(planParts(Array.from({ length: 4500 }, (_, i) => ({ id: `x${i}`, bytes: 10 }))).length, 3)
assert.deepEqual(planParts([]), [])

console.log(
    JSON.stringify(
        {
            ok: true,
            fileBytes: Buffer.byteLength(text),
            imported: parsed.recipes.map((r) => ({
                id: r.id,
                title: r.title.length > 40 ? `${r.title.slice(0, 40)}...` : r.title,
                servings: r.servings,
                ingredients: r.ingredients.length,
                instructions: r.instructions.length,
                image: r.image ? `${r.image.slice(0, 30)}... (${r.image.length} chars)` : '',
                sourceUrl: r.sourceUrl,
                tags: r.tags,
                createdAt: r.createdAt,
            })),
            skipped: ['D4untitled (no title)'],
            splitCheck: parts.map(({ part, from, to, recipes, bytes }) => ({ part, from, to, recipes, bytes })),
        },
        null,
        2,
    ),
)
