'use client'

import { useEffect, useRef } from 'react'
import styles from './ripple.module.scss'

/**
 * M3 ink ripple. Render as the last child of a `position: relative` (or
 * otherwise positioned) interactive element; it listens on its parent.
 *
 * Uses the Web Animations API against CSS-variable-driven keyframes so the
 * pressed ripple expands from the pointer, then fades on release. Skipped
 * entirely under prefers-reduced-motion.
 */
export function Ripple({ color }: { color?: string }) {
    const hostRef = useRef<HTMLSpanElement>(null)

    useEffect(() => {
        const host = hostRef.current
        const parent = host?.parentElement
        if (!host || !parent) return

        const onPointerDown = (event: PointerEvent) => {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
            if (parent.matches(':disabled, [data-disabled], [aria-disabled="true"]')) return

            const rect = host.getBoundingClientRect()
            const x = event.clientX - rect.left
            const y = event.clientY - rect.top
            // Radius reaching the farthest corner, softened by the blur.
            const radius = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y)) + 10

            const ink = document.createElement('span')
            ink.className = styles.ink as string
            if (color) ink.style.color = color
            ink.style.left = `${x}px`
            ink.style.top = `${y}px`
            ink.style.width = `${radius * 2}px`
            ink.style.height = `${radius * 2}px`
            host.appendChild(ink)

            const expand = ink.animate(
                { transform: ['translate(-50%, -50%) scale(0.1)', 'translate(-50%, -50%) scale(1)'] },
                { duration: 450, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'forwards' },
            )

            let released = false
            const release = () => {
                if (released) return
                released = true
                window.removeEventListener('pointerup', release)
                window.removeEventListener('pointercancel', release)
                const fade = () => {
                    const fadeOut = ink.animate(
                        { opacity: [getComputedStyle(ink).opacity, '0'] },
                        { duration: 250, easing: 'linear', fill: 'forwards' },
                    )
                    fadeOut.onfinish = () => ink.remove()
                }
                // Let the expansion register before fading so quick taps still show.
                if (expand.playState === 'finished') fade()
                else setTimeout(fade, 150)
            }
            window.addEventListener('pointerup', release)
            window.addEventListener('pointercancel', release)
        }

        parent.addEventListener('pointerdown', onPointerDown)
        return () => parent.removeEventListener('pointerdown', onPointerDown)
    }, [color])

    return <span ref={hostRef} className={styles.ripple} aria-hidden="true" />
}
