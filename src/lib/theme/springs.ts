/**
 * M3 spring tokens (Compose ExpressiveMotionTokens / StandardMotionTokens) and
 * the closed-form solution of a damped spring with mass 1. Pure math so the
 * CSS generator, the `motion` transitions and the shape morph share one source.
 */

export type MotionScheme = 'expressive' | 'standard'
export type SpringKind = 'spatial' | 'effects'
export type SpringSpeed = 'fast' | 'default' | 'slow'
export type SpringToken = `${SpringKind}-${SpringSpeed}`

export interface SpringSpec {
    /** Damping ratio (zeta). */
    damping: number
    /** Compose stiffness, equal to the squared natural frequency. */
    stiffness: number
}

const EFFECTS = {
    'effects-fast': { damping: 1, stiffness: 3800 },
    'effects-default': { damping: 1, stiffness: 1600 },
    'effects-slow': { damping: 1, stiffness: 800 },
} as const satisfies Record<string, SpringSpec>

export const SPRINGS: Record<MotionScheme, Record<SpringToken, SpringSpec>> = {
    expressive: {
        'spatial-fast': { damping: 0.6, stiffness: 800 },
        'spatial-default': { damping: 0.8, stiffness: 380 },
        'spatial-slow': { damping: 0.8, stiffness: 200 },
        ...EFFECTS,
    },
    standard: {
        'spatial-fast': { damping: 0.9, stiffness: 1400 },
        'spatial-default': { damping: 0.9, stiffness: 700 },
        'spatial-slow': { damping: 0.9, stiffness: 300 },
        ...EFFECTS,
    },
}

export const SPRING_TOKENS = Object.keys(SPRINGS.expressive) as SpringToken[]

/** Position of a spring released at rest from 0 toward 1, at time `t` seconds. */
export function springAt(t: number, { damping: z, stiffness: k }: SpringSpec): number {
    const w = Math.sqrt(k)
    if (z < 1) {
        const wd = w * Math.sqrt(1 - z * z)
        return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t))
    }
    return 1 - Math.exp(-w * t) * (1 + w * t)
}

/** Seconds until the spring stays within `epsilon` of its target. */
export function settleTime(spec: SpringSpec, epsilon = 0.001): number {
    const dt = 0.0005
    let last = 0
    for (let t = 0; t < 5; t += dt) {
        if (Math.abs(springAt(t, spec) - 1) > epsilon) last = t
    }
    return last
}

/** A CSS `linear()` easing that traces the spring over its settle time. */
export function springLinear(spec: SpringSpec, samples = 40): string {
    const duration = settleTime(spec)
    const points: string[] = []
    for (let i = 0; i <= samples; i++) {
        const value = i === samples ? 1 : springAt((duration * i) / samples, spec)
        points.push(String(Math.round(value * 1000) / 1000))
    }
    return `linear(${points.join(', ')})`
}
