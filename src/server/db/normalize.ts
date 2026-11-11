import type { DisplayContent, GroceryItem, RecipeSummary } from '@/lib/domain/types'
import { LIMITS } from '@/lib/domain/types'
import { deriveTotalMinutes } from '@/lib/recipe/time'
import type { RecipeRecord } from './types'

type Data = Record<string, unknown>

function s(value: unknown): string {
    if (typeof value === 'string') return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    return ''
}

function strings(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string' || typeof v === 'number').map(String) : []
}

/** Accepts epoch ms, Firestore Timestamps, Dates, and ISO strings. */
export function millis(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (value instanceof Date) return value.getTime()
    if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
        return Number(value.toMillis())
    }
    if (typeof value === 'string') {
        const t = Date.parse(value)
        return Number.isNaN(t) ? null : t
    }
    return null
}

export function normalizeTags(values: readonly unknown[]): string[] {
    const out: string[] = []
    for (const v of values) {
        if (typeof v !== 'string') continue
        const tag = v.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, LIMITS.tagLength)
        if (tag && !out.includes(tag)) out.push(tag)
        if (out.length >= LIMITS.tags) break
    }
    return out
}

/**
 * Reads any stored recipe shape, including legacy docs that predate tags, favorites,
 * Storage URLs, and timestamps, into a complete record.
 */
export function recipeFromData(id: string, data: Data): RecipeRecord {
    const storageImage = s(data.imageUrl)
    const hasStorage = storageImage.length > 0
    const prepTime = s(data.prepTime)
    const cookTime = s(data.cookTime)
    const totalTime = s(data.totalTime)
    const createdAt = millis(data.createdAt) ?? 0
    const totalMinutes =
        typeof data.totalMinutes === 'number' && Number.isFinite(data.totalMinutes)
            ? data.totalMinutes
            : deriveTotalMinutes({ prepTime, cookTime, totalTime })
    return {
        id,
        uid: s(data.uid),
        title: s(data.title),
        description: s(data.description),
        servings: s(data.servings),
        prepTime,
        cookTime,
        totalTime,
        totalMinutes,
        ingredients: strings(data.ingredients),
        instructions: strings(data.instructions),
        notes: s(data.notes),
        image: hasStorage ? storageImage : s(data.image),
        thumbnail: s(data.thumbnailUrl) || s(data.thumbnail) || (hasStorage ? storageImage : ''),
        seedColor: typeof data.seedColor === 'number' ? data.seedColor : null,
        tags: normalizeTags(Array.isArray(data.tags) ? data.tags : []),
        collectionIds: strings(data.collectionIds),
        favorite: data.favorite === true,
        sourceUrl: s(data.sourceUrl) || null,
        sourceName: s(data.sourceName) || null,
        cookCount: typeof data.cookCount === 'number' ? data.cookCount : 0,
        lastCookedAt: millis(data.lastCookedAt),
        createdAt,
        updatedAt: millis(data.updatedAt) ?? createdAt,
        imagePath: hasStorage ? s(data.imagePath) || null : null,
        thumbnailPath: hasStorage ? s(data.thumbnailPath) || null : null,
    }
}

export function summaryOf(r: RecipeRecord): RecipeSummary {
    return {
        id: r.id,
        title: r.title,
        thumbnail: r.thumbnail,
        seedColor: r.seedColor,
        tags: r.tags,
        collectionIds: r.collectionIds,
        favorite: r.favorite,
        totalMinutes: r.totalMinutes,
        totalTime: r.totalTime,
        sourceName: r.sourceName,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        lastCookedAt: r.lastCookedAt,
        cookCount: r.cookCount,
    }
}

/** Newest first, then by title, so lists are stable. */
export function byNewest<T extends { createdAt: number; title?: string; name?: string }>(a: T, b: T): number {
    return b.createdAt - a.createdAt || (a.title ?? a.name ?? '').localeCompare(b.title ?? b.name ?? '')
}

export function displayContentFrom(value: unknown): DisplayContent | null {
    if (!value || typeof value !== 'object') return null
    const v = value as Data
    if (typeof v.recipeId !== 'string') return null
    return {
        recipeId: v.recipeId,
        step: typeof v.step === 'number' ? v.step : null,
        scale: typeof v.scale === 'number' && v.scale > 0 ? v.scale : 1,
        sentAt: millis(v.sentAt) ?? 0,
    }
}

export function groceryItemsFrom(value: unknown): GroceryItem[] {
    if (!Array.isArray(value)) return []
    return value.filter((v): v is GroceryItem => Boolean(v) && typeof v === 'object' && typeof (v as Data).id === 'string')
}
