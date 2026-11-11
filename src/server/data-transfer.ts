import 'server-only'

import { z } from 'zod'
import { EXPORT_SCHEMA, type ImportCounts, LIMITS } from '@/lib/domain/types'
import { lineToGroceryItem, MAX_GROCERY_ITEMS } from '@/lib/recipe/grocery'
import { deriveTotalMinutes } from '@/lib/recipe/time'
import { normalizeTags } from './db/normalize'
import type { CollectionRecord, RecipeRecord, Store } from './db/types'
import { preparePhoto, toRecipe } from './recipes'

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024
export const MAX_IMPORT_RECIPES = 2000

/** Streams the export so a large library never sits in memory as one string. */
export function exportStream(store: Store, uid: string, now = new Date()): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    return new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                const [recipes, collections, grocery] = await Promise.all([
                    store.listRecipes(uid),
                    store.listCollections(uid),
                    store.getGroceryItems(uid),
                ])
                const push = (s: string) => controller.enqueue(encoder.encode(s))
                push(
                    `{"schema":${JSON.stringify(EXPORT_SCHEMA)},"exportedAt":${JSON.stringify(now.toISOString())},"recipes":[`,
                )
                recipes.forEach((r, i) => {
                    push(`${i ? ',' : ''}\n${JSON.stringify(toRecipe(r))}`)
                })
                push('\n],"collections":')
                push(JSON.stringify(collections.map((c) => ({ id: c.id, name: c.name, createdAt: c.createdAt }))))
                push(',"grocery":')
                push(JSON.stringify(grocery))
                push('}\n')
                controller.close()
            } catch (err) {
                controller.error(err)
            }
        },
    })
}

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

export type ExportFile = z.infer<typeof exportSchema>

export class ImportError extends Error {}

export function parseExport(text: string): ExportFile {
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

function dedupeKey(r: { title: string; sourceUrl: string | null; ingredients: string[] }): string {
    const title = r.title.trim().toLowerCase()
    return r.sourceUrl ? `u:${r.sourceUrl}|${title}` : `t:${title}|${r.ingredients.join('\n').toLowerCase()}`
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
    let next = 0
    const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
        while (next < items.length) {
            const item = items[next++] as T
            await fn(item)
        }
    })
    await Promise.all(workers)
}

/**
 * Merges an export into a library without duplicating anything: recipes match
 * by id, then by source URL plus title (or title plus ingredients when there is
 * no source); collections match by id, then by name.
 */
export async function importExport(
    store: Store,
    uid: string,
    file: ExportFile,
    now = Date.now(),
): Promise<ImportCounts> {
    const [existingRecipes, existingCollections] = await Promise.all([
        store.listRecipes(uid),
        store.listCollections(uid),
    ])
    const counts: ImportCounts = { recipesAdded: 0, recipesSkipped: 0, collectionsAdded: 0, groceryItemsAdded: 0 }

    const collectionMap = new Map<string, string>()
    const byName = new Map(existingCollections.map((c) => [c.name.trim().toLowerCase(), c.id]))
    const ownedCollectionIds = new Set(existingCollections.map((c) => c.id))
    for (const c of file.collections) {
        if (ownedCollectionIds.has(c.id)) {
            collectionMap.set(c.id, c.id)
            continue
        }
        const match = byName.get(c.name.trim().toLowerCase())
        if (match) {
            collectionMap.set(c.id, match)
            continue
        }
        if (ownedCollectionIds.size >= LIMITS.collections) continue
        const record: CollectionRecord = { id: store.newId(), uid, name: c.name.trim(), createdAt: now, updatedAt: now }
        await store.createCollection(record)
        collectionMap.set(c.id, record.id)
        byName.set(record.name.toLowerCase(), record.id)
        ownedCollectionIds.add(record.id)
        counts.collectionsAdded++
    }

    const ids = new Set(existingRecipes.map((r) => r.id))
    const keys = new Set(existingRecipes.map(dedupeKey))
    const toCreate = file.recipes.filter((r) => {
        const key = dedupeKey(r)
        if ((r.id && ids.has(r.id)) || keys.has(key)) {
            counts.recipesSkipped++
            return false
        }
        keys.add(key)
        return true
    })

    await pool(toCreate, 4, async (r) => {
        const id = store.newId()
        let photo: Pick<RecipeRecord, 'image' | 'thumbnail' | 'seedColor' | 'imagePath' | 'thumbnailPath'> = {
            image: '',
            thumbnail: '',
            seedColor: null,
            imagePath: null,
            thumbnailPath: null,
        }
        if (/^data:image\/(png|jpe?g|webp|gif|avif);base64,/i.test(r.image)) {
            try {
                photo = (await preparePhoto(store, uid, id, { kind: 'dataUrl', dataUrl: r.image })) ?? photo
            } catch {
                // An unreadable photo should not sink the whole import.
            }
        } else if (/^https:\/\//i.test(r.image)) {
            photo = { ...photo, image: r.image, thumbnail: r.image }
        }
        const record: RecipeRecord = {
            id,
            uid,
            title: r.title,
            description: r.description,
            servings: r.servings,
            prepTime: r.prepTime,
            cookTime: r.cookTime,
            totalTime: r.totalTime,
            totalMinutes: deriveTotalMinutes(r),
            ingredients: r.ingredients,
            instructions: r.instructions,
            notes: r.notes,
            ...photo,
            tags: normalizeTags(r.tags),
            collectionIds: [
                ...new Set(r.collectionIds.map((c) => collectionMap.get(c)).filter((c): c is string => Boolean(c))),
            ],
            favorite: r.favorite,
            sourceUrl: r.sourceUrl,
            sourceName: r.sourceName,
            cookCount: r.cookCount,
            lastCookedAt: r.lastCookedAt,
            createdAt: r.createdAt ?? now,
            updatedAt: now,
        }
        await store.createRecipe(record)
        counts.recipesAdded++
    })

    if (file.grocery.length) {
        await store.updateGroceryItems(uid, (items) => {
            const seen = new Set(items.map((i) => i.text.toLowerCase()))
            const out = [...items]
            for (const g of file.grocery) {
                if (out.length >= MAX_GROCERY_ITEMS) break
                if (seen.has(g.text.toLowerCase())) continue
                seen.add(g.text.toLowerCase())
                const item = lineToGroceryItem(g.text, { now, newId: () => store.newId() })
                if (item) out.push({ ...item, checked: g.checked })
            }
            // Assigned, not incremented: Firestore may run this callback more than once.
            counts.groceryItemsAdded = out.length - items.length
            return out
        })
    }
    return counts
}
