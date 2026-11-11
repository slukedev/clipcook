'use client'

import { useSyncExternalStore } from 'react'
import { readJson, writeJson } from './storage'

// Per-recipe view state shared by the recipe page and cook mode: checked ingredients,
// finished steps, the servings scale and the cook-mode step. Kept in sessionStorage so a
// refresh resumes, and in memory so separate client islands stay in sync.

interface Slot<T> {
    value: T
    listeners: Set<() => void>
}

const slots = new Map<string, Slot<unknown>>()

function createState<T>(prefix: string, fallback: T, validate: (value: unknown) => T) {
    const keyFor = (recipeId: string) => `cc:${prefix}:${recipeId}`

    function slot(recipeId: string): Slot<T> {
        const key = keyFor(recipeId)
        let s = slots.get(key) as Slot<T> | undefined
        if (!s) {
            s = { value: validate(readJson<unknown>('session', key, fallback)), listeners: new Set() }
            slots.set(key, s as Slot<unknown>)
        }
        return s
    }

    function get(recipeId: string): T {
        return slot(recipeId).value
    }

    function set(recipeId: string, next: T | ((current: T) => T)): void {
        const s = slot(recipeId)
        const value = typeof next === 'function' ? (next as (current: T) => T)(s.value) : next
        if (Object.is(value, s.value)) return
        s.value = value
        writeJson('session', keyFor(recipeId), value)
        for (const listener of s.listeners) listener()
    }

    /** Forgets the stored value without re-rendering anyone, for a screen that is leaving. */
    function forget(recipeId: string): void {
        slot(recipeId).value = fallback
        writeJson('session', keyFor(recipeId), null)
    }

    function subscribe(recipeId: string, onChange: () => void): () => void {
        const s = slot(recipeId)
        s.listeners.add(onChange)
        return () => {
            s.listeners.delete(onChange)
        }
    }

    return { get, set, forget, subscribe, fallback }
}

const EMPTY: readonly number[] = Object.freeze([])

function indexList(value: unknown): readonly number[] {
    if (!Array.isArray(value) || value.length === 0) return EMPTY
    return value.every((n) => Number.isInteger(n) && n >= 0) ? (value as number[]) : EMPTY
}

/** Indices into `recipe.ingredients` that are checked off. */
export const checkedIngredients = createState<readonly number[]>('checked', EMPTY, indexList)
/** Step indices (headings excluded) marked done on the recipe page. */
export const doneSteps = createState<readonly number[]>('done', EMPTY, indexList)
/** Servings multiplier. */
export const recipeScale = createState<number>('scale', 1, (v) =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 100 ? v : 1,
)
/** Current cook-mode step (headings excluded). */
export const cookStep = createState<number>('step', 0, (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0,
)

export type IndexState = typeof checkedIngredients

/** Reads one piece of per-recipe state and re-renders when it changes. */
export function useRecipeState<T>(
    state: { get: (id: string) => T; subscribe: (id: string, onChange: () => void) => () => void; fallback: T },
    recipeId: string,
): T {
    return useSyncExternalStore(
        (onChange) => state.subscribe(recipeId, onChange),
        () => state.get(recipeId),
        () => state.fallback,
    )
}

/** Adds or removes one index; `on` forces the state. */
export function toggleIndex(state: IndexState, recipeId: string, index: number, on?: boolean): void {
    state.set(recipeId, (list) => {
        const has = list.includes(index)
        const want = on ?? !has
        if (want === has) return list
        return want ? [...list, index].sort((a, b) => a - b) : list.filter((n) => n !== index)
    })
}

export { EMPTY as NO_INDICES }
