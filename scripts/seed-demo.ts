/**
 * Seeds the local backend with a realistic library for the demo cook: recipes with
 * photos, collections and a grocery list. No cloud setup, no network.
 *
 *   CLIPCOOK_BACKEND=local npm run seed:demo            wipe the demo cook's data, then seed
 *   CLIPCOOK_BACKEND=local npm run seed:demo -- --keep  seed on top of what is there
 *   ... -- --preview=/some/dir                          also write each photo as PNG there
 *
 * Recipes and their photos live in src/server/starter, shared with the starter recipes a
 * new account can add. Photos are drawn procedurally as SVG and pushed through the same pipeline as a real
 * upload, so image, thumbnail and seed color look exactly like user data.
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { GroceryItem } from '../src/lib/domain/types'
import { addGroceryLines } from '../src/lib/recipe/grocery'
import { deriveTotalMinutes } from '../src/lib/recipe/time'
import { DEMO_USER } from '../src/server/auth'
import { getStore, resolveBackend } from '../src/server/db'
import { localDataDir } from '../src/server/db/local'
import { normalizeTags } from '../src/server/db/normalize'
import type { RecipeRecord, Store } from '../src/server/db/types'
import { processInlineRecipeImage } from '../src/server/images'
import { type Dish, drawDish } from '../src/server/starter/dishes'
import { RECIPES } from '../src/server/starter/recipes'

const COLLECTIONS: Array<{ name: string; daysAgo: number; recipes: string[] }> = [
    {
        name: 'Weeknights',
        daysAgo: 110,
        recipes: ['pesto', 'curry', 'salad', 'tacos', 'lemonChicken', 'stirFry', 'shakshuka'],
    },
    { name: 'Holiday baking', daysAgo: 60, recipes: ['cake', 'cookies', 'gingerbread', 'sourdough', 'bananaBread'] },
    { name: 'Meal prep', daysAgo: 85, recipes: ['curry', 'chili', 'oats', 'souvlaki', 'tomatoSoup'] },
    { name: 'Try next', daysAgo: 7, recipes: ['ramen', 'souvlaki', 'bananaBread', 'stirFry'] },
]

const GROCERY: Array<{ lines: string[]; recipe?: string; checked?: string[] }> = [
    { recipe: 'curry', lines: ['1 (14-ounce) can coconut milk', '2 medium sweet potatoes', '1 bunch cilantro'] },
    { recipe: 'tacos', lines: ['1 1/2 pounds cod fillets', '3 limes', '12 small corn tortillas'] },
    {
        lines: [
            '12 large eggs',
            '2 cups whole milk',
            '1 sourdough loaf',
            '2 tablespoons smoked paprika',
            '1 bag frozen peas',
            '1 bottle dry white wine',
            'paper towels',
        ],
    },
]
const CHECKED = ['egg', 'smoked paprika', 'cilantro']

// ---------------------------------------------------------------- seeding

const DAY = 24 * 60 * 60 * 1000

async function wipe(store: Store, uid: string): Promise<number> {
    const [recipes, collections, displays] = await Promise.all([
        store.listRecipes(uid),
        store.listCollections(uid),
        store.listDisplays(uid),
    ])
    for (const r of recipes) await store.deleteRecipe(uid, r.id)
    for (const c of collections) await store.deleteCollection(uid, c.id)
    for (const d of displays) await store.deleteDisplay(uid, d.id)
    await store.updateGroceryItems(uid, () => [])
    return recipes.length
}

async function renderPhoto(dish: Dish, seed: string): Promise<{ svg: string; jpeg: Buffer }> {
    const svg = drawDish(dish, seed)
    const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 90, mozjpeg: true }).toBuffer()
    return { svg, jpeg }
}

async function main(): Promise<void> {
    const started = Date.now()
    const args = process.argv.slice(2)
    const keep = args.includes('--keep')
    const previewDir = args.find((a) => a.startsWith('--preview='))?.slice('--preview='.length)

    if (resolveBackend() !== 'local') {
        throw new Error('seed:demo only writes to the local backend. Run it with CLIPCOOK_BACKEND=local.')
    }
    const store = await getStore()
    if (store.backend !== 'local') throw new Error('Expected the local store.')
    const uid = DEMO_USER.uid

    const wiped = keep ? 0 : await wipe(store, uid)

    const photos = await Promise.all(
        RECIPES.map(async (r) => {
            if (!r.dish) return null
            const { jpeg } = await renderPhoto(r.dish, r.key)
            if (previewDir) {
                await mkdir(previewDir, { recursive: true })
                await sharp(jpeg)
                    .png()
                    .toFile(path.join(previewDir, `${r.key}.png`))
            }
            return processInlineRecipeImage(jpeg)
        }),
    )

    const now = Date.now()
    const ids = new Map<string, string>()
    for (const [i, r] of RECIPES.entries()) {
        const id = store.newId()
        ids.set(r.key, id)
        // A few hours of jitter so recipes created the same day still sort predictably.
        const createdAt = now - r.daysAgo * DAY - ((i * 37) % 11) * 60 * 60 * 1000
        const lastCookedAt = r.cooked ? now - r.cooked.daysAgo * DAY - ((i * 13) % 7) * 60 * 60 * 1000 : null
        const photo = photos[i]
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
            notes: r.notes ?? '',
            image: photo?.image ?? '',
            thumbnail: photo?.thumbnail ?? '',
            seedColor: photo?.seedColor ?? null,
            imagePath: null,
            thumbnailPath: null,
            tags: normalizeTags(r.tags),
            collectionIds: [],
            favorite: r.favorite ?? false,
            sourceUrl: r.source?.[1] ?? null,
            sourceName: r.source?.[0] ?? null,
            cookCount: r.cooked?.count ?? 0,
            lastCookedAt,
            createdAt,
            updatedAt: Math.max(createdAt + 20 * 60 * 1000, lastCookedAt ?? 0),
        }
        await store.createRecipe(record)
    }

    for (const c of COLLECTIONS) {
        const id = store.newId()
        const createdAt = now - c.daysAgo * DAY
        await store.createCollection({ id, uid, name: c.name, createdAt, updatedAt: createdAt })
        const members = c.recipes.map((key) => {
            const rid = ids.get(key)
            if (!rid) throw new Error(`Unknown recipe key in collection ${c.name}: ${key}`)
            return rid
        })
        await store.setCollectionMembership(uid, id, members, true)
    }

    const groceries = await store.updateGroceryItems(uid, (current) => {
        let items: GroceryItem[] = current
        for (const [i, group] of GROCERY.entries()) {
            items = addGroceryLines(items, group.lines, {
                recipeId: group.recipe ? ids.get(group.recipe) : undefined,
                now: now - (GROCERY.length - i) * 45 * 60 * 1000,
                newId: () => store.newId(),
            })
        }
        return items.map((item) => (CHECKED.includes(item.name) ? { ...item, checked: true } : item))
    })

    const photoCount = photos.filter(Boolean).length
    const checked = groceries.filter((g) => g.checked).length
    const secs = ((Date.now() - started) / 1000).toFixed(1)
    console.log(
        `Seeded demo cook (${uid}): ${RECIPES.length} recipes (${photoCount} photos), ${COLLECTIONS.length} collections, ${groceries.length} grocery items (${checked} checked)${keep ? '' : `, wiped ${wiped} old recipes`} in ${path.join(localDataDir(), 'clipcook.json')} [${secs}s]`,
    )
}

main().catch((err: unknown) => {
    console.error(`seed:demo failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
})
