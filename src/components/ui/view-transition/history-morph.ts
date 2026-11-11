import { vtName } from '@/lib/theme/view-transition'

/**
 * Marks an element as one half of a shared element that `goBackWithMorph` can pair
 * across a history traversal. React's <ViewTransition> cannot do this: Next renders
 * back/forward synchronously inside popstate, which React never animates.
 */
export function morphTarget(kind: 'photo' | 'title', id: string): Record<string, string> {
    return { [`data-vt-${kind}`]: id }
}

const KINDS = ['photo', 'title'] as const
const NAMES = { photo: 'recipe-photo', title: 'recipe-title' } as const

function visible(el: Element): boolean {
    const r = el.getBoundingClientRect()
    return r.bottom > 0 && r.top < window.innerHeight && r.width > 0
}

function tag(id: string): HTMLElement[] {
    const tagged: HTMLElement[] = []
    for (const kind of KINDS) {
        const el = document.querySelector<HTMLElement>(`[data-vt-${kind}="${CSS.escape(id)}"]`)
        if (!el || !visible(el)) continue
        el.style.setProperty('view-transition-name', vtName(NAMES[kind], id))
        el.style.setProperty('view-transition-class', 'cc-shared')
        tagged.push(el)
    }
    return tagged
}

function untag(els: HTMLElement[]): void {
    for (const el of els) {
        el.style.removeProperty('view-transition-name')
        el.style.removeProperty('view-transition-class')
    }
}

/**
 * Goes back in history while the recipe's photo and title morph into their library card.
 * Falls back to a plain `back()` without View Transitions; when the card is not on screen
 * after the traversal, the pages simply crossfade.
 */
export function goBackWithMorph(id: string, back: () => void): void {
    if (typeof document.startViewTransition !== 'function') {
        back()
        return
    }
    const from = tag(id)
    let to: HTMLElement[] = []
    const transition = document.startViewTransition(async () => {
        untag(from)
        const settled = new Promise<void>((resolve) => {
            // Next commits the cached page inside popstate; one task later the DOM is the library.
            const done = () => setTimeout(resolve, 0)
            window.addEventListener('popstate', done, { once: true })
            setTimeout(resolve, 400)
        })
        back()
        await settled
        to = tag(id)
    })
    transition.finished.finally(() => untag(to))
}
