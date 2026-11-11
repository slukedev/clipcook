'use client'

import { type RefObject, useLayoutEffect } from 'react'

/**
 * Steps the type down until the step fits its stage, so nothing in it ever needs a
 * scroll from floury hands. CSS sets the largest size; this only ever shrinks it.
 * Re-fits when the stage resizes (rotation, the tray growing, a keyboard).
 */
export function useFitText(
    box: RefObject<HTMLElement | null>,
    content: RefObject<HTMLElement | null>,
    key: string,
    minPx = 18,
): void {
    // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is what changes the text inside the refs
    useLayoutEffect(() => {
        const stage = box.current
        const el = content.current
        if (!stage || !el) return
        let frame = 0
        let width = -1
        let height = -1

        const fits = () => stage.scrollHeight <= stage.clientHeight + 1
        const refit = () => {
            frame = 0
            el.style.removeProperty('font-size')
            if (fits()) return
            const max = Number.parseFloat(getComputedStyle(el).fontSize)
            let lo = minPx
            let hi = max
            while (hi - lo > 0.5) {
                const mid = (lo + hi) / 2
                el.style.fontSize = `${mid}px`
                if (fits()) lo = mid
                else hi = mid
            }
            el.style.fontSize = `${Math.floor(lo * 2) / 2}px`
        }

        refit()
        // The web font can land after the first fit and change every line break.
        let live = true
        void document.fonts?.ready.then(() => {
            if (live && !frame) frame = requestAnimationFrame(refit)
        })
        const observer = new ResizeObserver(([entry]) => {
            const size = entry?.contentBoxSize[0]
            if (!size || (size.inlineSize === width && size.blockSize === height)) return
            width = size.inlineSize
            height = size.blockSize
            if (!frame) frame = requestAnimationFrame(refit)
        })
        observer.observe(stage)
        return () => {
            live = false
            observer.disconnect()
            cancelAnimationFrame(frame)
        }
    }, [key])
}
