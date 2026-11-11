'use client'

import { useEffect, useState } from 'react'

/**
 * True while the window scrolls down past `threshold` (40dp, as M3 floating
 * toolbars and FABs use), false again on any upward scroll or near the top.
 */
export function useScrollHidden(enabled: boolean, threshold = 40): boolean {
    const [hidden, setHidden] = useState(false)
    useEffect(() => {
        if (!enabled) return
        let last = window.scrollY
        let frame = 0
        const onScroll = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                const y = window.scrollY
                if (y < threshold) setHidden(false)
                else if (y > last + 8) setHidden(true)
                else if (y < last - 8) setHidden(false)
                last = y
            })
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            window.removeEventListener('scroll', onScroll)
            cancelAnimationFrame(frame)
        }
    }, [enabled, threshold])
    return enabled && hidden
}
