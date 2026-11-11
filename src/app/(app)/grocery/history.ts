import type { GroceryItem } from '@/lib/domain/types'
import { lineToGroceryItem } from '@/lib/recipe/grocery'
import { parseIngredient } from '@/lib/recipe/ingredients'

/** Something bought before, kept on this device so it can go back on the list in one tap. */
export interface PastItem {
    /** What the chip says: the item without its amount, as it was typed ("whole milk"). */
    label: string
    /** Merge key, so "2 cups milk" and "milk" count as the same thing. */
    name: string
    count: number
    last: number
}

const MAX_HISTORY = 200

function labelFor(line: string): { label: string; name: string } | null {
    const item = lineToGroceryItem(line, { now: 0, newId: () => '' })
    if (!item) return null
    const label = (item.quantity === null ? item.text : parseIngredient(item.text).name || item.text).trim()
    return label ? { label, name: item.name } : null
}

/** Adds freshly added lines to the history, most recent first. */
export function remember(history: readonly PastItem[], lines: readonly string[], now: number): PastItem[] {
    const next = [...history]
    for (const line of lines) {
        const parsed = labelFor(line)
        if (!parsed) continue
        const index = next.findIndex((p) => p.name === parsed.name)
        const previous = index === -1 ? null : next.splice(index, 1)[0]
        next.unshift({ label: parsed.label, name: parsed.name, count: (previous?.count ?? 0) + 1, last: now })
    }
    return next.slice(0, MAX_HISTORY)
}

/**
 * What to offer under the add field: things bought before that are not on the list yet,
 * matching what has been typed so far. Frequent items lead; recent ones break ties.
 */
export function suggestions(
    history: readonly PastItem[],
    onList: readonly GroceryItem[],
    query: string,
    limit = 8,
): PastItem[] {
    const listed = new Set(onList.filter((item) => !item.checked).map((item) => item.name))
    const q = query.trim().toLocaleLowerCase()
    return history
        .filter((p) => !listed.has(p.name))
        .filter((p) => !q || p.label.toLocaleLowerCase().includes(q))
        .filter((p) => p.label.toLocaleLowerCase() !== q)
        .toSorted((a, b) => {
            // A typed prefix beats a match in the middle of the word.
            if (q) {
                const pa = Number(a.label.toLocaleLowerCase().startsWith(q))
                const pb = Number(b.label.toLocaleLowerCase().startsWith(q))
                if (pa !== pb) return pb - pa
            }
            return b.count - a.count || b.last - a.last
        })
        .slice(0, limit)
}

function isPast(value: unknown): value is PastItem {
    if (!value || typeof value !== 'object') return false
    const p = value as Record<string, unknown>
    return (
        typeof p.label === 'string' &&
        typeof p.name === 'string' &&
        typeof p.count === 'number' &&
        typeof p.last === 'number'
    )
}

export function parseHistory(raw: string | null): PastItem[] {
    if (!raw) return []
    try {
        const value: unknown = JSON.parse(raw)
        return Array.isArray(value) ? value.filter(isPast).slice(0, MAX_HISTORY) : []
    } catch {
        return []
    }
}
