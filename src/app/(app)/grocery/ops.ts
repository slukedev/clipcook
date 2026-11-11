import type { GroceryItem } from '@/lib/domain/types'
import { lineToGroceryItem, addGroceryLines as mergeLines } from '@/lib/recipe/grocery'

/** One change to the list. The same shape is applied on screen, queued offline and sent to the server. */
export type GroceryOp =
    | { type: 'add'; lines: string[]; ids: string[]; now: number }
    | { type: 'check'; id: string; checked: boolean }
    | { type: 'edit'; id: string; text: string }
    | { type: 'remove'; id: string }
    | { type: 'clearChecked' }
    | { type: 'clearAll' }

/** The same merge the server runs, so the list on screen matches what comes back. */
export function applyOp(items: GroceryItem[], op: GroceryOp): GroceryItem[] {
    switch (op.type) {
        case 'add': {
            let next = 0
            return mergeLines(items, op.lines, { now: op.now, newId: () => op.ids[next++] ?? `tmp-${next}` })
        }
        case 'check':
            return items.map((item) => (item.id === op.id ? { ...item, checked: op.checked } : item))
        case 'edit':
            return items.map((item) => {
                if (item.id !== op.id) return item
                const parsed = lineToGroceryItem(op.text, { now: item.addedAt, newId: () => item.id })
                return parsed ? { ...parsed, checked: item.checked, recipeIds: item.recipeIds } : item
            })
        case 'remove':
            return items.filter((item) => item.id !== op.id)
        case 'clearChecked':
            return items.filter((item) => !item.checked)
        case 'clearAll':
            return []
    }
}

export function applyOps(items: GroceryItem[], ops: readonly GroceryOp[]): GroceryItem[] {
    return ops.reduce(applyOp, items)
}

/**
 * After a queued add reaches the server, its temporary ids become real ones. Rows are
 * matched by text first, then by position, so later queued changes to those rows still land.
 */
export function idsAfterAdd(
    before: GroceryItem[],
    op: Extract<GroceryOp, { type: 'add' }>,
    saved: readonly GroceryItem[],
): Map<string, string> {
    const local = applyOp(before, op)
    const temp = new Set(op.ids)
    const known = new Set(before.map((item) => item.id))
    const fresh = saved.filter((item) => !known.has(item.id))
    const taken = new Set<string>()
    const map = new Map<string, string>()
    for (const item of local) {
        if (!temp.has(item.id)) continue
        const match =
            fresh.find((s) => !taken.has(s.id) && s.text === item.text) ??
            fresh.find((s) => !taken.has(s.id) && s.name === item.name)
        if (!match) continue
        taken.add(match.id)
        map.set(item.id, match.id)
    }
    return map
}

/** Points queued changes at the ids the server gave. */
export function remapOps(ops: readonly GroceryOp[], ids: ReadonlyMap<string, string>): GroceryOp[] {
    if (ids.size === 0) return [...ops]
    return ops.map((op) => ('id' in op && ids.has(op.id) ? { ...op, id: ids.get(op.id) as string } : op))
}

/** Checking the same row twice offline only needs the last answer. */
export function compactOps(ops: readonly GroceryOp[]): GroceryOp[] {
    const out: GroceryOp[] = []
    for (const op of ops) {
        const last = out.at(-1)
        if (op.type === 'check' && last?.type === 'check' && last.id === op.id) out[out.length - 1] = op
        else out.push(op)
    }
    return out
}

function isOp(value: unknown): value is GroceryOp {
    if (!value || typeof value !== 'object') return false
    const op = value as Record<string, unknown>
    switch (op.type) {
        case 'add':
            return Array.isArray(op.lines) && Array.isArray(op.ids) && typeof op.now === 'number'
        case 'check':
            return typeof op.id === 'string' && typeof op.checked === 'boolean'
        case 'edit':
            return typeof op.id === 'string' && typeof op.text === 'string'
        case 'remove':
            return typeof op.id === 'string'
        case 'clearChecked':
        case 'clearAll':
            return true
        default:
            return false
    }
}

/** Reads a stored queue, dropping anything that does not look like a change. */
export function parseQueue(raw: string | null): GroceryOp[] {
    if (!raw) return []
    try {
        const value: unknown = JSON.parse(raw)
        return Array.isArray(value) ? value.filter(isOp) : []
    } catch {
        return []
    }
}
