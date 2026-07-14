import type { Transition } from 'motion/react'

/**
 * M3 Expressive motion physics — spring tokens for the `motion` library.
 * https://m3.material.io/styles/motion/overview/how-it-works
 *
 * M3 publishes springs as (damping ratio, stiffness). `motion` takes a
 * damping *coefficient*, so convert: c = ζ · 2√(k·m) with mass 1.
 *
 * Spatial springs move things (position, size, shape) and may overshoot;
 * effect springs animate paint (opacity, color) and must not.
 */
function spring(stiffness: number, dampingRatio: number): Transition {
    return {
        type: 'spring',
        stiffness,
        damping: dampingRatio * 2 * Math.sqrt(stiffness),
        mass: 1,
    }
}

export const spatial = {
    fast: spring(1400, 0.9),
    default: spring(700, 0.9),
    slow: spring(300, 0.9),
} as const

export const effects = {
    fast: spring(3800, 1),
    default: spring(1600, 1),
    slow: spring(800, 1),
} as const

/** Instant transition for prefers-reduced-motion. */
export const instant: Transition = { duration: 0 }
