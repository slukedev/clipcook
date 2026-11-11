'use client'

import { useEffect, useRef, useState } from 'react'

function isPlainClick(event: MouseEvent): boolean {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

/**
 * Keeps unsaved work from vanishing: the browser's own prompt on reload or close, and
 * an in-app confirm for link clicks anywhere on the page (the shell's navigation too).
 * Returns the href waiting on an answer; `release()` lets the next navigation through.
 */
export function useUnsavedGuard(dirty: boolean) {
    const [pendingHref, setPendingHref] = useState<string | null>(null)
    const [isReleased, setReleased] = useState(false)
    const released = useRef(false)
    const active = dirty && !isReleased

    useEffect(() => {
        if (!active) return
        function onBeforeUnload(event: BeforeUnloadEvent) {
            if (released.current) return
            event.preventDefault()
            event.returnValue = ''
        }
        function onClick(event: MouseEvent) {
            if (released.current || event.defaultPrevented || !isPlainClick(event)) return
            const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
            if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
            const url = new URL(anchor.href, window.location.href)
            if (url.origin !== window.location.origin) return
            if (url.pathname === window.location.pathname && url.search === window.location.search) return
            event.preventDefault()
            event.stopPropagation()
            setPendingHref(`${url.pathname}${url.search}${url.hash}`)
        }
        window.addEventListener('beforeunload', onBeforeUnload)
        window.addEventListener('click', onClick, true)
        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload)
            window.removeEventListener('click', onClick, true)
        }
    }, [active])

    return {
        pendingHref,
        ask: (href: string) => setPendingHref(href),
        cancel: () => setPendingHref(null),
        release: () => {
            released.current = true
            setReleased(true)
            setPendingHref(null)
        },
    }
}
