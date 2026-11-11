import { vtName } from '@/lib/theme/view-transition'
import { freshVtName } from './generation'

/**
 * Shared elements that `goBackWithMorph` can pair across a history traversal. React's
 * <ViewTransition> cannot do this: Next renders back/forward synchronously inside
 * popstate, which React never animates.
 */
const KINDS = {
    photo: { name: 'recipe-photo', className: 'cc-shared' },
    cook: { name: 'cook', className: 'cc-cook' },
} as const

export type MorphKind = keyof typeof KINDS

/** Marks an element as one half of a shared element for `goBackWithMorph`. */
export function morphTarget(kind: MorphKind, id: string): Record<string, string> {
    return { [`data-vt-${kind}`]: id }
}

function visible(el: Element): boolean {
    const r = el.getBoundingClientRect()
    return r.bottom > 0 && r.top < window.innerHeight && r.width > 0
}

function tag(id: string, kinds: readonly MorphKind[]): HTMLElement[] {
    const tagged: HTMLElement[] = []
    for (const kind of kinds) {
        const el = document.querySelector<HTMLElement>(`[data-vt-${kind}="${CSS.escape(id)}"]`)
        if (!el || !visible(el)) continue
        el.style.setProperty('view-transition-name', freshVtName(vtName(KINDS[kind].name, id)))
        el.style.setProperty('view-transition-class', KINDS[kind].className)
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
 * Images on the page we land on are in the cache but not always decoded yet. The new
 * snapshot is taken once the update resolves, so wait a moment for the ones in view or
 * the morph lands on empty frames.
 */
function decodeVisibleImages(budgetMs: number): Promise<void> {
    const pending: Promise<unknown>[] = []
    for (const img of document.querySelectorAll<HTMLImageElement>('main img')) {
        if (img.complete && img.naturalWidth > 0) continue
        if (!visible(img)) continue
        img.loading = 'eager'
        pending.push(img.decode().catch(() => undefined))
    }
    if (pending.length === 0) return Promise.resolve()
    return Promise.race([Promise.all(pending).then(() => undefined), wait(budgetMs)])
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

interface MorphOptions {
    /** Which shared elements pair up. Default: the recipe photo. */
    kinds?: readonly MorphKind[]
    /**
     * `crossfade` fades the rest of the page through (leaving a recipe for the library).
     * `anchored` shows the page underneath at once (closing cook mode into its button).
     */
    rest?: 'crossfade' | 'anchored'
}

/**
 * Goes back in history while the shared elements morph into their counterparts on the
 * page behind. Falls back to a plain `back()` without View Transitions; when a
 * counterpart is not on screen after the traversal, that element simply fades.
 */
export function goBackWithMorph(id: string, back: () => void, options: MorphOptions = {}): void {
    const { kinds = ['photo'], rest = 'crossfade' } = options
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (typeof document.startViewTransition !== 'function' || reduce) {
        back()
        return
    }
    const root = document.documentElement
    if (rest === 'crossfade') root.dataset.vtRoot = 'back'
    const from = tag(id, kinds)
    let to: HTMLElement[] = []
    const transition = document.startViewTransition(async () => {
        untag(from)
        const settled = new Promise<void>((resolve) => {
            // Next commits the cached page inside popstate; one task later the DOM is the page behind.
            const done = () => setTimeout(resolve, 0)
            window.addEventListener('popstate', done, { once: true })
            setTimeout(resolve, 400)
        })
        back()
        await settled
        await decodeVisibleImages(120)
        to = tag(id, kinds)
    })
    transition.finished.finally(() => {
        untag(to)
        delete root.dataset.vtRoot
    })
}
