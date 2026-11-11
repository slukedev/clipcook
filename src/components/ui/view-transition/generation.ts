'use client'

import { useSyncExternalStore } from 'react'
import { vtName } from '@/lib/theme/view-transition'

/**
 * WebKit keeps the CSS animations of a view transition's pseudo-elements after the
 * transition ends, keyed by view-transition-name and animation name. When a later
 * transition brings the same name back with the same keyframes, it reuses those
 * animations instead of starting fresh ones: they are already finished (the snapshot
 * jumps to its end state) or cancelled, which React does to every one when a transition
 * ends (the snapshot never animates at all). A page that entered under a name and
 * leaves under it again sits fully opaque over the next page.
 *
 * Two things keep every transition on fresh animations:
 * - Elements carry a name that never repeats. The generation advances when each
 *   transition finishes and boundaries re-render with the new name, so the next
 *   transition captures them under names WebKit has not seen.
 * - Snapshots whose names cannot change (the root, the app chrome) alternate between
 *   two copies of each keyframe, picked by `data-vt-parity` on the root.
 */
let generation = 0
const listeners = new Set<() => void>()

function advance() {
    generation += 1
    document.documentElement.dataset.vtParity = String(generation % 2)
    for (const listener of listeners) listener()
}

function install() {
    const native = document.startViewTransition
    if (typeof native !== 'function' || (native as { ccTracked?: boolean }).ccTracked) return
    const tracked = function (this: Document, ...args: Parameters<Document['startViewTransition']>) {
        const transition = native.apply(this, args)
        transition.finished.finally(advance)
        return transition
    } as Document['startViewTransition'] & { ccTracked?: boolean }
    tracked.ccTracked = true
    document.startViewTransition = tracked
}

if (typeof document !== 'undefined') install()

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

/** `name` tagged with the current generation, so it is never reused across transitions. */
export function freshVtName(name: string, gen = generation): string {
    return vtName(name, `g${gen}`)
}

/** `freshVtName` that re-renders when a transition finishes. */
export function useFreshVtName(name: string): string {
    const gen = useSyncExternalStore(
        subscribe,
        () => generation,
        () => 0,
    )
    return freshVtName(name, gen)
}
