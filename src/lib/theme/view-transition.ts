/**
 * A valid `view-transition-name` for a shared element, such as
 * `vtName('recipe-photo', id)`. The same call on both pages pairs the elements.
 */
export function vtName(kind: string, id: string | number): string {
    return `${kind}-${String(id).replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

/** Transition types the router passes to React, styled in src/styles/_view-transitions.scss. */
export type NavDirection = 'forward' | 'back' | 'fade'

export function transitionTypesFor(direction: NavDirection): string[] {
    return [`nav-${direction}`]
}
