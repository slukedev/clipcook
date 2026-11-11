import type { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types'
import type { useRouter } from 'next/navigation'

type Router = Pick<ReturnType<typeof useRouter>, 'prefetch'>

/**
 * Prefetches a whole dynamic page, data included, instead of only its loading shell.
 * A navigation to it then commits in one step, so shared elements can morph and the
 * skeleton never flashes. Fresh entries are reused, so repeated calls are cheap.
 */
export function prefetchPage(router: Router, href: string): void {
    router.prefetch(href, { kind: 'full' as PrefetchKind } as Parameters<Router['prefetch']>[1])
}

/** Runs `work` when the main thread is idle, or soon after on browsers without idle callbacks. */
export function whenIdle(work: () => void, timeout = 1500): () => void {
    if (typeof window.requestIdleCallback === 'function') {
        const handle = window.requestIdleCallback(work, { timeout })
        return () => window.cancelIdleCallback(handle)
    }
    const handle = window.setTimeout(work, 200)
    return () => window.clearTimeout(handle)
}
