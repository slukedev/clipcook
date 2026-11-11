'use client'

import { useSyncExternalStore } from 'react'

// The step the reader is on while scrolling the recipe page, so the ingredients pane
// beside the steps can point at what that step uses. In memory only: it follows the scroll.

let focus: { recipeId: string; step: number } | null = null
const listeners = new Set<() => void>()

export function setFocusedStep(recipeId: string, step: number | null): void {
    const next = step === null ? null : { recipeId, step }
    if (focus?.recipeId === next?.recipeId && focus?.step === next?.step) return
    if (step === null && focus?.recipeId !== recipeId) return
    focus = next
    for (const listener of listeners) listener()
}

function subscribe(onChange: () => void) {
    listeners.add(onChange)
    return () => {
        listeners.delete(onChange)
    }
}

/** The focused step index (headings excluded) for this recipe, or null. */
export function useFocusedStep(recipeId: string): number | null {
    return useSyncExternalStore(
        subscribe,
        () => (focus?.recipeId === recipeId ? focus.step : null),
        () => null,
    )
}
