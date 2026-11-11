'use client'

import { useSyncExternalStore } from 'react'
import { deleteRecipe } from '@/actions/recipes'

// Deletes wait out the Undo snackbar before they reach the server. Recipes in here
// are hidden everywhere the library grid renders, across navigations.

export const UNDO_WINDOW = 8000

interface Batch {
    ids: string[]
    timer: number
    committing: boolean
    onFailed: (error: string, retry: () => void) => void
}

const batches = new Set<Batch>()
// Deleted on the server; stays hidden so nothing flickers back before fresh props arrive.
const gone = new Set<string>()
let hidden: ReadonlySet<string> = new Set()
const listeners = new Set<() => void>()

function publish() {
    hidden = new Set([...gone, ...[...batches].flatMap((b) => b.ids)])
    for (const listener of listeners) listener()
}

async function commit(batch: Batch) {
    window.clearTimeout(batch.timer)
    if (!batches.has(batch) || batch.committing) return
    batch.committing = true
    const results = await Promise.all(batch.ids.map((id) => deleteRecipe(id)))
    batches.delete(batch)
    batch.ids.forEach((id, i) => {
        if (results[i]?.ok) gone.add(id)
    })
    publish()
    const failed = batch.ids.filter((_, i) => !results[i]?.ok)
    const error = results.find((r) => !r.ok)
    if (failed.length > 0 && error && !error.ok) {
        batch.onFailed(error.error, () => scheduleDelete(failed, batch.onFailed))
    }
}

/** Hides the recipes now and deletes them when the undo window closes. Returns undo. */
export function scheduleDelete(ids: string[], onFailed: Batch['onFailed']): () => boolean {
    const batch: Batch = { ids, onFailed, timer: 0, committing: false }
    batch.timer = window.setTimeout(() => void commit(batch), UNDO_WINDOW)
    batches.add(batch)
    publish()
    flushOnHide()
    let undone = false
    return () => {
        // The snackbar can stay up after Undo; a second press is still a success.
        if (undone) return true
        if (!batches.has(batch) || batch.committing) return false
        undone = true
        window.clearTimeout(batch.timer)
        batches.delete(batch)
        publish()
        return true
    }
}

let flushing = false

// A closing tab would otherwise drop the delete; send it while the page can still talk.
function flushOnHide() {
    if (flushing) return
    flushing = true
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') for (const batch of batches) void commit(batch)
    })
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

const EMPTY: ReadonlySet<string> = new Set()

/** Recipe ids waiting to be deleted. */
export function usePendingDeletes(): ReadonlySet<string> {
    return useSyncExternalStore(
        subscribe,
        () => hidden,
        () => EMPTY,
    )
}
