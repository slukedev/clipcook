import { type ReactNode, ViewTransition } from 'react'

/**
 * Wraps a page's content so route changes animate: shared axis X for
 * `nav-forward` / `nav-back` transition types, a fade through otherwise.
 * Uses React's <ViewTransition>, which Next.js drives from router navigations.
 */
export function PageTransition({ children }: { children: ReactNode }) {
    const classes = { 'nav-forward': 'cc-forward', 'nav-back': 'cc-back', default: 'cc-fade' }
    return (
        <ViewTransition enter={classes} exit={classes} default="none">
            {children}
        </ViewTransition>
    )
}

/**
 * Pairs an element across routes (recipe photo in the list and on the detail page)
 * so it morphs between them. Name it with `vtName('recipe-photo', id)` on both sides.
 */
export function SharedElement({ name, children }: { name: string; children: ReactNode }) {
    return (
        <ViewTransition name={name} share="cc-shared" default="none">
            {children}
        </ViewTransition>
    )
}
