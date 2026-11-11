// Domain types shared by server and client code. No runtime imports here.

export type RecipeId = string

export interface Recipe {
    id: RecipeId
    title: string
    description: string
    servings: string
    prepTime: string
    cookTime: string
    totalTime: string
    totalMinutes: number | null
    /** Lines; a line starting with '# ' is a section heading. */
    ingredients: string[]
    instructions: string[]
    notes: string
    /** URL, data URL, or '' when the recipe has no photo. */
    image: string
    thumbnail: string
    /** ARGB seed extracted from the photo. */
    seedColor: number | null
    tags: string[]
    collectionIds: string[]
    favorite: boolean
    sourceUrl: string | null
    sourceName: string | null
    cookCount: number
    lastCookedAt: number | null
    createdAt: number
    updatedAt: number
}

export type RecipeSummary = Pick<
    Recipe,
    | 'id'
    | 'title'
    | 'thumbnail'
    | 'seedColor'
    | 'tags'
    | 'collectionIds'
    | 'favorite'
    | 'totalMinutes'
    | 'totalTime'
    | 'sourceName'
    | 'sourceUrl'
    | 'createdAt'
    | 'updatedAt'
    | 'lastCookedAt'
    | 'cookCount'
>

export interface Collection {
    id: string
    name: string
    createdAt: number
    recipeCount: number
    /** Up to 4 recipe thumbnails, most recently updated first. */
    coverThumbnails: string[]
}

export interface TagCount {
    tag: string
    count: number
}

export type GroceryCategory =
    | 'produce'
    | 'meat-seafood'
    | 'dairy-eggs'
    | 'bakery'
    | 'pantry'
    | 'spices'
    | 'frozen'
    | 'drinks'
    | 'other'

export interface GroceryItem {
    id: string
    /** What the user sees, e.g. '2 cups flour'. */
    text: string
    /** Normalized ingredient name used for merging, e.g. 'flour'. */
    name: string
    quantity: number | null
    unit: string | null
    category: GroceryCategory
    checked: boolean
    recipeIds: string[]
    addedAt: number
}

export interface DisplayContent {
    recipeId: string
    /** Zero-based instruction index (headings excluded), or null for the overview. */
    step: number | null
    scale: number
    sentAt: number
}

export interface KitchenDisplay {
    id: string
    name: string
    createdAt: number
    lastSeenAt: number | null
    current: DisplayContent | null
}

/** What `GET /api/display/state` returns. */
export interface DisplayState {
    id: string
    name: string
    current: DisplayContent | null
    version: number
}

/** A recipe parsed from a URL, pasted text, or the bookmarklet. Everything is optional. */
export interface ImportedRecipe {
    title?: string
    description?: string
    servings?: string
    prepTime?: string
    cookTime?: string
    totalTime?: string
    ingredients?: string[]
    instructions?: string[]
    notes?: string
    /** data URL (already downscaled WebP when it came from a clip). */
    image?: string
    sourceUrl?: string
    sourceName?: string
    tags?: string[]
}

/** `code` is a stable machine-readable reason; `error` is the sentence to show. */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string; code?: string }

/** Failure codes the clip actions return. */
export type ClipFailureCode =
    | 'invalid_url'
    | 'blocked_address'
    | 'not_html'
    | 'not_found'
    | 'too_large'
    | 'too_many_redirects'
    | 'blocked'
    | 'timeout'
    | 'network'
    | 'rate_limited'
    | 'upstream'
    | 'no_recipe'
    | 'bad_image'
    | 'empty'
    | 'too_long'
    | 'unauthenticated'
    | 'draft_expired'

export interface ImportCounts {
    recipesAdded: number
    recipesSkipped: number
    collectionsAdded: number
    groceryItemsAdded: number
}

export const EXPORT_SCHEMA = 'clipcook.export.v1' as const

export const LIMITS = {
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
