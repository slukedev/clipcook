import type { RecipeSummary } from '@/lib/domain/types'
import { fold, queryTokens } from '@/lib/recipe/search'
import { formatMinutes } from '@/lib/recipe/time'

export type SortKey = 'recent' | 'az' | 'cooked' | 'quickest'
export type ViewMode = 'grid' | 'list'

export const SORTS: { value: SortKey; label: string }[] = [
    { value: 'recent', label: 'Recent' },
    { value: 'az', label: 'A to Z' },
    { value: 'cooked', label: 'Recently cooked' },
    { value: 'quickest', label: 'Quickest' },
]

export const LIBRARY_COOKIE = 'clipcook_library'

export interface LibraryPrefs {
    view: ViewMode
    sort: SortKey
}

export function parseLibraryPrefs(value: string | undefined): LibraryPrefs {
    const [view, sort] = (value ?? '').split('.')
    return {
        view: view === 'list' ? 'list' : 'grid',
        sort: SORTS.some((s) => s.value === sort) ? (sort as SortKey) : 'recent',
    }
}

export function serializeLibraryPrefs(prefs: LibraryPrefs): string {
    return `${prefs.view}.${prefs.sort}`
}

export { fold, queryTokens }

/** Every token must appear in the title, a tag or the source. */
export function matches(recipe: SearchableRecipe, tokens: string[]): boolean {
    if (tokens.length === 0) return true
    return tokens.every((token) => recipe.haystack.includes(token))
}

export interface SearchableRecipe extends RecipeSummary {
    haystack: string
}

export function searchable(recipes: RecipeSummary[]): SearchableRecipe[] {
    return recipes.map((r) => ({ ...r, haystack: fold([r.title, r.sourceName ?? '', ...r.tags].join('\n')) }))
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

export function sortRecipes<T extends RecipeSummary>(recipes: T[], sort: SortKey): T[] {
    switch (sort) {
        case 'az':
            return recipes.toSorted((a, b) => collator.compare(a.title, b.title))
        case 'cooked':
            return recipes.toSorted(
                (a, b) => (b.lastCookedAt ?? 0) - (a.lastCookedAt ?? 0) || b.createdAt - a.createdAt,
            )
        case 'quickest':
            return recipes.toSorted(
                (a, b) =>
                    (a.totalMinutes ?? Number.POSITIVE_INFINITY) - (b.totalMinutes ?? Number.POSITIVE_INFINITY) ||
                    collator.compare(a.title, b.title),
            )
        default:
            return recipes.toSorted((a, b) => b.createdAt - a.createdAt)
    }
}

/** [start, end) ranges in `text` that match a token, merged and sorted. */
export function highlightRanges(text: string, tokens: string[]): [number, number][] {
    if (tokens.length === 0) return []
    // Folding can change length (ligatures, combining marks), so map folded indices back per character.
    const map: number[] = []
    let folded = ''
    for (let i = 0; i < text.length; i++) {
        const piece = fold(text[i] ?? '')
        for (let k = 0; k < piece.length; k++) map.push(i)
        folded += piece
    }
    map.push(text.length)
    const ranges: [number, number][] = []
    for (const token of tokens) {
        let from = folded.indexOf(token)
        while (from !== -1) {
            ranges.push([map[from] ?? 0, (map[from + token.length - 1] ?? text.length - 1) + 1])
            from = folded.indexOf(token, from + token.length)
        }
    }
    ranges.sort((a, b) => a[0] - b[0])
    const merged: [number, number][] = []
    for (const range of ranges) {
        const last = merged.at(-1)
        if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
        else merged.push([range[0], range[1]])
    }
    return merged
}

/** "35 min · Serious Eats", leaving out whatever is missing. */
export function recipeMeta(recipe: Pick<RecipeSummary, 'totalMinutes' | 'totalTime' | 'sourceName'>): string {
    const time = recipe.totalMinutes ? formatMinutes(recipe.totalMinutes) : recipe.totalTime
    return [time, recipe.sourceName].filter(Boolean).join(' · ')
}

function hash(text: string): number {
    let h = 2166136261
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return h >>> 0
}

// Food hues: paprika, saffron, olive, basil, sage, beet, berry, crust.
const HUES = [32, 70, 105, 140, 165, 10, 350, 55]
const SHAPES = ['cookie9', 'clover4', 'sunny', 'flower', 'puffy', 'cookie6', 'gem', 'cookie12', 'clover8'] as const

export interface PlaceholderLook {
    hue: number
    shape: (typeof SHAPES)[number]
    initial: string
}

/** A stable look for a recipe without a photo, from its title. */
export function placeholderLook(title: string): PlaceholderLook {
    const h = hash(title.trim().toLowerCase())
    const initial = Array.from(title.trim())[0]?.toLocaleUpperCase() ?? '?'
    return { hue: HUES[h % HUES.length] ?? 32, shape: SHAPES[(h >>> 8) % SHAPES.length] ?? 'cookie9', initial }
}
