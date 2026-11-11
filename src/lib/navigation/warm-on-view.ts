'use client'

import { type RefObject, useEffect, useEffectEvent } from 'react'
import { whenIdle } from './prefetch'

/** How long a link has to stay on screen before its page is worth fetching. */
const DWELL_MS = 500

const callbacks = new WeakMap<Element, () => void>()
const timers = new WeakMap<Element, number>()
let observer: IntersectionObserver | null = null

function saveData(): boolean {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    return connection?.saveData === true
}

function sharedObserver(): IntersectionObserver {
    observer ??= new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                const target = entry.target
                window.clearTimeout(timers.get(target))
                if (!entry.isIntersecting) continue
                timers.set(
                    target,
                    window.setTimeout(() => {
                        observer?.unobserve(target)
                        whenIdle(() => callbacks.get(target)?.())
                    }, DWELL_MS),
                )
            }
        },
        { threshold: 0.5 },
    )
    return observer
}

/**
 * Calls `warm` once the element has rested in view for a moment, on an idle frame.
 * Scrolling past does nothing; Save-Data turns it off. Taps then land on a page that is
 * already in the client cache, which touch screens cannot get from hover prefetching.
 */
export function useWarmOnView(ref: RefObject<Element | null>, warm: () => void, enabled = true): void {
    const run = useEffectEvent(warm)
    useEffect(() => {
        const el = ref.current
        if (!el || !enabled || saveData()) return
        callbacks.set(el, run)
        const io = sharedObserver()
        io.observe(el)
        return () => {
            io.unobserve(el)
            window.clearTimeout(timers.get(el))
            callbacks.delete(el)
        }
    }, [ref, enabled])
}
