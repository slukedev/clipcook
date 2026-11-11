'use client'

import { useEffect, useRef } from 'react'
import styles from './ripple.module.scss'

// material-web ripple timings: grow 450ms, hold at least 225ms, fade 375ms.
const GROW_MS = 450
const MIN_PRESS_MS = 225
const FADE_MS = 375
// A touch that turns into a scroll should not ripple.
const TOUCH_DELAY_MS = 120

function isDisabled(host: HTMLElement) {
    return host.matches(':disabled, [data-disabled], [aria-disabled="true"]')
}

/**
 * M3 press ripple. Drop it inside any interactive container that has
 * `position: relative` (the state-layer mixin provides that): it listens to its
 * parent, grows from the pointer and clips to the parent's shape. Also sets
 * `data-ripple-pressed` on the parent so CSS can morph shapes while pressed.
 */
export function Ripple({ disabled = false }: { disabled?: boolean }) {
    const ref = useRef<HTMLSpanElement>(null)

    useEffect(() => {
        const surface = ref.current
        const host = surface?.parentElement
        if (!surface || !host) return
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
        let wave: HTMLSpanElement | null = null
        let pressedAt = 0
        let touchTimer = 0
        let pending: PointerEvent | null = null

        const start = (event: PointerEvent) => {
            const rect = host.getBoundingClientRect()
            const x = event.clientX - rect.left
            const y = event.clientY - rect.top
            const radius = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y))
            const size = Math.max(rect.width, rect.height) * 0.3
            wave = document.createElement('span')
            wave.className = styles.wave ?? ''
            wave.style.inlineSize = wave.style.blockSize = `${radius * 2}px`
            wave.style.insetInlineStart = `${x - radius}px`
            wave.style.insetBlockStart = `${y - radius}px`
            surface.append(wave)
            pressedAt = performance.now()
            host.dataset.ripplePressed = ''
            const from = reduce.matches ? 1 : size / (radius * 2)
            wave.animate([{ transform: `scale(${from})` }, { transform: 'scale(1)' }], {
                duration: reduce.matches ? 0 : GROW_MS,
                easing: 'cubic-bezier(0.2, 0, 0, 1)',
                fill: 'forwards',
            })
            wave.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 75, fill: 'forwards' })
        }

        const end = () => {
            window.clearTimeout(touchTimer)
            pending = null
            delete host.dataset.ripplePressed
            const current = wave
            if (!current) return
            wave = null
            const wait = Math.max(0, MIN_PRESS_MS - (performance.now() - pressedAt))
            current
                .animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, delay: wait, fill: 'forwards' })
                .finished.then(() => current.remove(), () => current.remove())
        }

        const onDown = (event: PointerEvent) => {
            if (disabled || event.button !== 0 || isDisabled(host)) return
            if (event.pointerType === 'touch') {
                pending = event
                touchTimer = window.setTimeout(() => {
                    pending = null
                    start(event)
                }, TOUCH_DELAY_MS)
            } else {
                start(event)
            }
        }
        const onUp = () => {
            // A tap shorter than the touch delay still gets its ripple.
            if (pending) {
                window.clearTimeout(touchTimer)
                start(pending)
            }
            end()
        }

        host.addEventListener('pointerdown', onDown)
        host.addEventListener('pointerup', onUp)
        host.addEventListener('pointercancel', end)
        host.addEventListener('pointerleave', end)
        host.addEventListener('contextmenu', end)
        return () => {
            host.removeEventListener('pointerdown', onDown)
            host.removeEventListener('pointerup', onUp)
            host.removeEventListener('pointercancel', end)
            host.removeEventListener('pointerleave', end)
            host.removeEventListener('contextmenu', end)
            window.clearTimeout(touchTimer)
        }
    }, [disabled])

    return <span ref={ref} className={styles.surface} data-ripple-surface="" aria-hidden />
}
