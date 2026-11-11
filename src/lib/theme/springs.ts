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

/**
 * A CSS `linear()` easing that traces the spring over its settle time.
 *
 * The browser samples this curve once per displayed frame, whatever the refresh rate,
 * so the curve itself has to be smooth at 120Hz and beyond. Evenly spaced stops leave
 * the fast start under-sampled (visible speed kinks on long moves) and waste stops on
 * the flat tail. Instead the spring is traced at 0.5ms and simplified until no point
 * strays more than `tolerance` (fraction of the distance) from the true curve.
 */
export function springLinear(spec: SpringSpec, tolerance = 0.0005): string {
    const duration = settleTime(spec)
    const steps = Math.max(1, Math.ceil(duration / 0.0005))
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i <= steps; i++) {
        xs.push(i / steps)
        ys.push(i === steps ? 1 : springAt((duration * i) / steps, spec))
    }
    const keep = new Uint8Array(xs.length)
    keep[0] = 1
    keep[xs.length - 1] = 1
    // Ramer–Douglas–Peucker on the progress axis (vertical error is what the eye sees).
    const stack: Array<[number, number]> = [[0, xs.length - 1]]
    while (stack.length) {
        const [a, b] = stack.pop() as [number, number]
        const xa = xs[a] as number
        const ya = ys[a] as number
        const slope = ((ys[b] as number) - ya) / ((xs[b] as number) - xa)
        let worst = -1
        let error = tolerance
        for (let i = a + 1; i < b; i++) {
            const e = Math.abs((ys[i] as number) - (ya + slope * ((xs[i] as number) - xa)))
            if (e > error) {
                error = e
                worst = i
            }
        }
        if (worst > 0) {
            keep[worst] = 1
            stack.push([a, worst], [worst, b])
        }
    }
    const round = (v: number, places: number) => String(Math.round(v * 10 ** places) / 10 ** places)
    const points: string[] = []
    for (let i = 0; i < xs.length; i++) {
        if (!keep[i]) continue
        const y = round(ys[i] as number, 4)
        points.push(i === 0 || i === xs.length - 1 ? y : `${y} ${round((xs[i] as number) * 100, 2)}%`)
    }
    return `linear(${points.join(', ')})`
}
