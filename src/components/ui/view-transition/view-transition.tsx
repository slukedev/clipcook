'use client'

import { type ReactNode, useState, ViewTransition } from 'react'
import { useFreshVtName } from './generation'

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

// The deeper page holds the large photo, under its own top bar and sheet, so it stays
// above the photo while the photo morphs to or from a card: entering on the way in,
// leaving on the way out. Closing cook mode shrinks it back into the button over a page
// that is already there.
const ENTER = { ...PAGE, 'nav-forward': 'cc-forward cc-over', cook: 'none', 'cook-close': 'none' }
const EXIT = { ...PAGE, 'nav-back': 'cc-back cc-over' }

let pages = 0

/**
 * Wraps a page's content, or the loading skeleton that stands in for it, so route
 * changes animate: shared axis X for `nav-forward` / `nav-back`, fade through for
 * `nav-fade`, and a crossfade when a skeleton gives way to the page. The app chrome
 * stays anchored. Uses React's <ViewTransition>, which Next.js drives from navigations.
 */
export function PageTransition({ children }: { children: ReactNode }) {
    // Each page has its own name (an entering and a leaving page must not pair), fresh
    // for every transition (see ./generation).
    const [page] = useState(() => ++pages)
    const name = useFreshVtName(`page-${page}`)
    return (
        <ViewTransition name={name} enter={ENTER} exit={EXIT} share="none" default="none">
            {children}
        </ViewTransition>
    )
}

// Only route changes pair shared elements. A list re-rendering in place (a filter, the
// grid and list toggle) remounts the same names, and those must not fly across the page.
const SHARE = { 'nav-forward': 'cc-shared', 'nav-back': 'cc-shared', 'nav-fade': 'cc-shared', default: 'none' }

/**
 * Pairs an element across routes (recipe photo in the list and on the detail page)
 * so it morphs between them. Name it with `vtName('recipe-photo', id)` on both sides.
 * `share` replaces the default morph class (the Cook button to cook mode uses `cc-cook`).
 */
export function SharedElement({
    name,
    share = SHARE,
    children,
}: {
    name: string
    share?: string | typeof SHARE
    children: ReactNode
}) {
    const fresh = useFreshVtName(name)
    return (
        <ViewTransition name={fresh} share={share} default="none">
            {children}
        </ViewTransition>
    )
}
