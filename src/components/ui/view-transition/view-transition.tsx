import { type ReactNode, ViewTransition } from 'react'

/**
 * Transition type to class, styled in src/styles/_view-transitions.scss. A Suspense reveal
 * carries no type, so `default` is the skeleton handing over to its content. Opening cook
 * mode holds the page still while the Cook button grows over it.
 */
const PAGE = {
    'nav-forward': 'cc-forward',
    'nav-back': 'cc-back',
    'nav-fade': 'cc-fade',
    cook: 'cc-hold',
    default: 'cc-reveal',
}

// Closing cook mode shrinks it back into the button over a page that is already there.
const ENTER = { ...PAGE, cook: 'none', 'cook-close': 'none' }

/**
 * Wraps a page's content, or the loading skeleton that stands in for it, so route
 * changes animate: shared axis X for `nav-forward` / `nav-back`, fade through for
 * `nav-fade`, and a crossfade when a skeleton gives way to the page. The app chrome
 * stays anchored. Uses React's <ViewTransition>, which Next.js drives from navigations.
 */
export function PageTransition({ children }: { children: ReactNode }) {
    return (
        <ViewTransition enter={ENTER} exit={PAGE} default="none">
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
