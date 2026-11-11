type Router = { push: (href: string) => void; refresh: () => void }

/**
 * Opens a page right after this screen changed its data. A destination prefetched just
 * before the change can land in the router cache after the action purged it, so the
 * page would show what it held before; the refresh queues behind the navigation and
 * fetches the new page for real.
 */
export function pushFresh(router: Router, href: string): void {
    router.push(href)
    router.refresh()
}
