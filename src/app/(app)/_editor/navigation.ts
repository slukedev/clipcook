'use client'

interface NavigationEntryLike {
    url: string | null
    index: number
}

interface NavigationLike {
    canGoBack: boolean
    currentEntry: NavigationEntryLike | null
    entries(): NavigationEntryLike[]
}

/**
 * Path of the in-app page before this one, when the Navigation API knows it
 * (same-origin entries only). Null when there is none or the browser cannot tell.
 */
export function previousPath(): string | null {
    const nav = (window as Window & { navigation?: NavigationLike }).navigation
    if (!nav?.canGoBack || !nav.currentEntry) return null
    const prev = nav.entries()[nav.currentEntry.index - 1]
    if (!prev?.url) return null
    try {
        const url = new URL(prev.url)
        return url.origin === window.location.origin ? url.pathname : null
    } catch {
        return null
    }
}
