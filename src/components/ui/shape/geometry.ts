import { SHAPE_PATHS, type ShapeName } from './shape-paths'

/**
 * Shape morphing for the web. Compose matches polygon features (Morph.kt); here
 * every path is resampled to the same number of points by arc length, so any two
 * MaterialShapes interpolate point by point. At 120 points the chords are well
 * under a pixel at the sizes these shapes are drawn.
 */

export type Points = Float32Array

const SAMPLES = 120
const cache = new Map<string, Points>()

type Segment = (t: number) => [number, number]

function parse(d: string): Segment[] {
    const tokens = d.match(/[MLCZ]|-?\d*\.?\d+/g) ?? []
    const segments: Segment[] = []
    let i = 0
    let x = 0
    let y = 0
    let sx = 0
    let sy = 0
    const num = () => Number(tokens[i++])
    while (i < tokens.length) {
        const cmd = tokens[i++]
        if (cmd === 'M') {
            x = sx = num()
            y = sy = num()
        } else if (cmd === 'L' || cmd === 'Z') {
            const [x0, y0] = [x, y]
            const [x1, y1] = cmd === 'L' ? [num(), num()] : [sx, sy]
            segments.push((t) => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t])
            x = x1
            y = y1
        } else if (cmd === 'C') {
            const p = [x, y, num(), num(), num(), num(), num(), num()] as const
            segments.push((t) => {
                const u = 1 - t
                const a = u * u * u
                const b = 3 * u * u * t
                const c = 3 * u * t * t
                const e = t * t * t
                return [a * p[0] + b * p[2] + c * p[4] + e * p[6], a * p[1] + b * p[3] + c * p[5] + e * p[7]]
            })
            x = p[6]
            y = p[7]
        }
    }
    return segments
}

function resample(d: string): Points {
    // Dense polyline first, then even spacing along its length.
    const dense: [number, number][] = []
    for (const segment of parse(d)) {
        for (let k = 0; k < 24; k++) dense.push(segment(k / 24))
    }
    const lengths = [0]
    for (let k = 1; k <= dense.length; k++) {
        const a = dense[k - 1] as [number, number]
        const b = dense[k % dense.length] as [number, number]
        lengths.push((lengths[k - 1] as number) + Math.hypot(b[0] - a[0], b[1] - a[1]))
    }
    const total = lengths[dense.length] as number
    const out = new Float32Array(SAMPLES * 2)
    let j = 0
    for (let s = 0; s < SAMPLES; s++) {
        const target = (total * s) / SAMPLES
        while ((lengths[j + 1] as number) < target) j++
        const a = dense[j] as [number, number]
        const b = dense[(j + 1) % dense.length] as [number, number]
        const span = (lengths[j + 1] as number) - (lengths[j] as number) || 1
        const t = (target - (lengths[j] as number)) / span
        out[s * 2] = a[0] + (b[0] - a[0]) * t
        out[s * 2 + 1] = a[1] + (b[1] - a[1]) * t
    }
    return orient(out)
}

/** Clockwise, starting from the point closest to straight up. */
function orient(points: Points): Points {
    let area = 0
    for (let s = 0; s < SAMPLES; s++) {
        const n = (s + 1) % SAMPLES
        area +=
            (points[s * 2] as number) * (points[n * 2 + 1] as number) -
            (points[n * 2] as number) * (points[s * 2 + 1] as number)
    }
    const order = area < 0 ? [...Array(SAMPLES).keys()].reverse() : [...Array(SAMPLES).keys()]
    let start = 0
    let best = Number.POSITIVE_INFINITY
    order.forEach((idx, k) => {
        const angle = Math.atan2((points[idx * 2 + 1] as number) - 50, (points[idx * 2] as number) - 50)
        const delta = Math.abs(angle + Math.PI / 2)
        if (delta < best) {
            best = delta
            start = k
        }
    })
    const out = new Float32Array(SAMPLES * 2)
    for (let s = 0; s < SAMPLES; s++) {
        const idx = order[(start + s) % SAMPLES] as number
        out[s * 2] = points[idx * 2] as number
        out[s * 2 + 1] = points[idx * 2 + 1] as number
    }
    return out
}

export function shapePoints(name: ShapeName): Points {
    let points = cache.get(name)
    if (!points) {
        points = resample(SHAPE_PATHS[name])
        cache.set(name, points)
    }
    return points
}

export function lerpPoints(from: Points, to: Points, t: number): Points {
    const out = new Float32Array(from.length)
    for (let k = 0; k < from.length; k++) {
        out[k] = (from[k] as number) + ((to[k] as number) - (from[k] as number)) * t
    }
    return out
}

/** Path data for a point set, scaled about the center of the 100 by 100 box. */
export function pointsToPath(points: Points, scale = 1): string {
    let d = ''
    for (let s = 0; s < points.length / 2; s++) {
        const x = 50 + ((points[s * 2] as number) - 50) * scale
        const y = 50 + ((points[s * 2 + 1] as number) - 50) * scale
        d += `${s === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
    }
    return `${d}Z`
}
