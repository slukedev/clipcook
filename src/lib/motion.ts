// Hooks here are for client components; the constants are safe anywhere.
import type { Transition } from 'motion/react'
import { useReducedMotion } from 'motion/react'
import { useSyncExternalStore } from 'react'
import { type MotionScheme, SPRINGS, type SpringSpec, type SpringToken } from './theme/springs'

export type { MotionScheme, SpringToken } from './theme/springs'
export { vtName } from './theme/view-transition'
export { useReducedMotion }

/**
 * M3 springs as `motion` transitions. M3 publishes (damping ratio, stiffness);
 * `motion` wants a damping coefficient: c = zeta * 2 * sqrt(k * m), with m = 1.
 */
export function toTransition({ damping, stiffness }: SpringSpec): Transition {
    return { type: 'spring', stiffness, damping: damping * 2 * Math.sqrt(stiffness), mass: 1 }
}

export function springTransition(token: SpringToken, scheme: MotionScheme = 'expressive'): Transition {
    return toTransition(SPRINGS[scheme][token])
}

/** Expressive transitions, for code that cannot use hooks. */
export const spring = {
    spatialFast: springTransition('spatial-fast'),
    spatialDefault: springTransition('spatial-default'),
    spatialSlow: springTransition('spatial-slow'),
    effectsFast: springTransition('effects-fast'),
    effectsDefault: springTransition('effects-default'),
    effectsSlow: springTransition('effects-slow'),
} as const

export const instant: Transition = { duration: 0 }

function readScheme(): MotionScheme {
    return document.documentElement.dataset.motion === 'standard' ? 'standard' : 'expressive'
}

function subscribeScheme(onChange: () => void) {
    const observer = new MutationObserver(onChange)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
    return () => observer.disconnect()
}

/** The active motion scheme (`data-motion` on <html>; Expressive by default). */
export function useMotionScheme(): MotionScheme {
    return useSyncExternalStore(subscribeScheme, readScheme, () => 'expressive')
}

/**
 * The transition for a token under the active scheme. With reduced motion,
 * spatial springs become instant and effects springs keep their fade.
 */
export function useSpring(token: SpringToken): Transition {
    const scheme = useMotionScheme()
    const reduce = useReducedMotion()
    if (reduce && token.startsWith('spatial')) return instant
    return springTransition(token, scheme)
}

/** Raw spring parameters for hand-rolled animation loops (gestures, shape morphs). */
export function useSpringSpec(token: SpringToken): SpringSpec {
    return SPRINGS[useMotionScheme()][token]
}
