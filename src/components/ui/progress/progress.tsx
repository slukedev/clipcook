'use client'

import { type HTMLAttributes, useEffect, useEffectEvent, useRef, useState } from 'react'
import { useReducedMotion } from '@/lib/motion'
import { cx } from '../cx'
import styles from './progress.module.scss'

// WavyProgressIndicator.kt / ProgressIndicator.kt numbers.
const STROKE = 4
const GAP = 4
const VALUE_MS = 500
const LINEAR_CYCLE = 1750
const CIRCULAR_CYCLE = 1333

function bezier(x1: number, y1: number, x2: number, y2: number) {
    const at = (a: number, b: number, t: number) => 3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t * t + t ** 3
    return (x: number) => {
        if (x <= 0) return 0
        if (x >= 1) return 1
        let lo = 0
        let hi = 1
        for (let i = 0; i < 20; i++) {
            const mid = (lo + hi) / 2
            if (at(x1, x2, mid) < x) lo = mid
            else hi = mid
        }
        return at(y1, y2, (lo + hi) / 2)
    }
}

const firstHead = bezier(0.2, 0, 0.8, 1)
const firstTail = bezier(0.4, 0, 1, 1)
const secondHead = bezier(0, 0, 0.65, 1)
const secondTail = bezier(0.1, 0, 0.45, 1)
const standard = bezier(0.2, 0, 0, 1)

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const phase = (t: number, delay: number, duration: number) => clamp01((t - delay) / duration)

/** Amplitude is zero near the ends so the wave never fights the caps. */
const amplitudeFor = (p: number) => (p <= 0.1 || p >= 0.95 ? 0 : 1)

interface Shared extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
    /** 0 to 1. Omit for indeterminate. */
    value?: number
    /** Expressive wavy active indicator. */
    wavy?: boolean
    /** Accessible name. */
    label?: string
}

/**
 * Runs `draw(now)` every frame until it returns false, pausing offscreen.
 * A new `key` (the target value) restarts a settled loop.
 */
function useFrames(
    draw: (now: number) => boolean,
    running: boolean,
    root: React.RefObject<Element | null>,
    key: unknown,
) {
    const onFrame = useEffectEvent(draw)
    // biome-ignore lint/correctness/useExhaustiveDependencies: `key` restarts the loop on purpose
    useEffect(() => {
        let frame = 0
        let visible = true
        const loop = (now: number) => {
            const more = onFrame(now)
            frame = more && visible && running ? requestAnimationFrame(loop) : 0
        }
        const observer = new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? true
            // Only one loop at a time: if the old one has not stopped yet, it carries on.
            if (visible && !frame) frame = requestAnimationFrame(loop)
        })
        if (root.current) observer.observe(root.current)
        frame = requestAnimationFrame(loop)
        return () => {
            cancelAnimationFrame(frame)
            observer.disconnect()
        }
    }, [running, root, key])
}

/** Tweens the displayed value toward `value` (linear, 500ms) and the wave amplitude with it. */
function useTween(value: number | undefined, reduce: boolean) {
    const state = useRef({ from: value ?? 0, to: value ?? 0, start: 0, ampFrom: amplitudeFor(value ?? 0), ampStart: 0 })

    function current(now: number) {
        const st = state.current
        const t = reduce ? 1 : clamp01((now - st.start) / VALUE_MS)
        const shown = st.from + (st.to - st.from) * t
        const at = reduce ? 1 : clamp01((now - st.ampStart) / VALUE_MS)
        const amp = st.ampFrom + (amplitudeFor(st.to) - st.ampFrom) * standard(at)
        return { value: shown, amp, settled: t >= 1 && at >= 1 }
    }

    const retarget = useEffectEvent((next: number) => {
        const st = state.current
        const now = performance.now()
        const shown = current(now)
        if (amplitudeFor(next) !== amplitudeFor(st.to)) {
            st.ampFrom = shown.amp
            st.ampStart = now
        }
        st.from = shown.value
        st.to = next
        st.start = now
    })
    useEffect(() => {
        if (value !== undefined) retarget(value)
    }, [value])

    return current
}

function wave(x0: number, x1: number, y: number, amp: number, length: number, offset: number): string {
    if (x1 <= x0) return ''
    if (amp === 0) return `M${x0} ${y}L${x1} ${y}`
    let d = ''
    for (let x = x0; ; x = Math.min(x1, x + 1.5)) {
        const yy = y + amp * Math.sin(((x + offset) / length) * 2 * Math.PI)
        d += `${d ? 'L' : 'M'}${x.toFixed(2)} ${yy.toFixed(2)}`
        if (x >= x1) break
    }
    return d
}

function line(x0: number, x1: number, y: number): string {
    return x1 > x0 ? `M${x0} ${y}L${x1} ${y}` : ''
}

/** M3 linear progress indicator, flat or wavy, determinate or indeterminate. */
export function LinearProgress({ value, wavy = false, label = 'Progress', className, ...rest }: Shared) {
    const root = useRef<HTMLDivElement>(null)
    const active = useRef<SVGPathElement>(null)
    const track = useRef<SVGPathElement>(null)
    const [width, setWidth] = useState(0)
    const reduce = Boolean(useReducedMotion())
    const determinate = value !== undefined
    const tween = useTween(value, reduce)
    const height = wavy ? 10 : 4
    const y = height / 2
    const amplitude = 3
    const cap = STROKE / 2

    useEffect(() => {
        const el = root.current
        if (!el) return
        const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry?.contentRect.width ?? 0)))
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const draw = (now: number) => {
        if (!width || !active.current || !track.current) return true
        const offset = reduce ? 0 : ((now / 1000) * (determinate ? 40 : 20)) % (determinate ? 40 : 20)
        const length = determinate ? 40 : 20
        const end = width - cap
        if (determinate) {
            const { value: v, amp, settled } = tween(now)
            const head = cap + (end - cap) * clamp01(v)
            const a = wavy ? amplitude * amp : 0
            active.current.setAttribute('d', v > 0 ? wave(cap, head, y, a, length, -offset) : '')
            track.current.setAttribute('d', line(Math.max(cap, v > 0 ? head + GAP + STROKE : cap), end, y))
            return wavy || !settled
        }
        const t = now % LINEAR_CYCLE
        const segments = [
            [firstTail(phase(t, 250, 1000)), firstHead(phase(t, 0, 1000))],
            [secondTail(phase(t, 900, 850)), secondHead(phase(t, 650, 850))],
        ] as const
        let activeD = ''
        let trackD = ''
        let cursor = cap
        for (const [tail, head] of segments) {
            const x0 = cap + (end - cap) * tail
            const x1 = cap + (end - cap) * head
            if (x1 - x0 < 0.5) continue
            trackD += line(cursor, x0 - GAP - STROKE, y)
            activeD += wave(x0, x1, y, wavy ? amplitude : 0, length, -offset)
            cursor = x1 + GAP + STROKE
        }
        trackD += line(cursor, end, y)
        active.current.setAttribute('d', activeD)
        track.current.setAttribute('d', trackD)
        return true
    }
    useFrames(draw, width > 0, root, value)

    return (
        <div
            ref={root}
            role="progressbar"
            aria-label={label}
            aria-valuemin={determinate ? 0 : undefined}
            aria-valuemax={determinate ? 100 : undefined}
            aria-valuenow={determinate ? Math.round(clamp01(value) * 100) : undefined}
            data-wavy={wavy || undefined}
            data-indeterminate={determinate ? undefined : ''}
            className={cx(styles.linear, className)}
            {...rest}
        >
            {width > 0 && (
                <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden focusable="false">
                    <path ref={track} className={styles.track} />
                    <path ref={active} className={styles.active} />
                    {determinate && <circle cx={width - cap} cy={y} r={STROKE / 2} className={styles.stop} />}
                </svg>
            )}
        </div>
    )
}

/** M3 circular progress indicator, flat (40dp) or wavy (48dp). */
export function CircularProgress({
    value,
    wavy = false,
    label = 'Progress',
    className,
    style,
    size,
    ...rest
}: Shared & { size?: number }) {
    const root = useRef<HTMLDivElement>(null)
    const active = useRef<SVGPathElement>(null)
    const track = useRef<SVGPathElement>(null)
    const reduce = Boolean(useReducedMotion())
    const determinate = value !== undefined
    const tween = useTween(value, reduce)
    const box = size ?? (wavy ? 48 : 40)
    const c = box / 2
    const amplitude = wavy ? 1.6 : 0
    const r = c - STROKE / 2 - amplitude
    const gapAngle = (GAP + STROKE) / r

    const arc = (from: number, to: number, amp: number, offset: number) => {
        if (to - from <= 0.001) return ''
        if (amp === 0 && to - from < Math.PI * 2 - 0.001) {
            const p = (a: number) => `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`
            return `M${p(from)}A${r} ${r} 0 ${to - from > Math.PI ? 1 : 0} 1 ${p(to)}`
        }
        // Wavelength 15dp measured along the circumference.
        let d = ''
        const step = 1.5 / r
        for (let a = from; ; a = Math.min(to, a + step)) {
            const rr = r + amp * Math.sin(((a * r + offset) / 15) * 2 * Math.PI)
            d += `${d ? 'L' : 'M'}${(c + rr * Math.sin(a)).toFixed(2)} ${(c - rr * Math.cos(a)).toFixed(2)}`
            if (a >= to) break
        }
        return d
    }

    const draw = (now: number) => {
        if (!active.current || !track.current) return false
        const offset = reduce ? 0 : ((now / 1000) * 15) % 15
        const full = Math.PI * 2
        if (determinate) {
            const { value: v, amp, settled } = tween(now)
            const sweep = full * clamp01(v)
            active.current.setAttribute('d', v > 0 ? arc(0, sweep, amplitude * amp, offset) : '')
            active.current.removeAttribute('transform')
            const trackFrom = v > 0 ? sweep + gapAngle : 0
            const trackTo = v > 0 ? full - gapAngle : full - 0.0001
            track.current.setAttribute('d', arc(trackFrom, trackTo, 0, 0))
            return wavy || !settled
        }
        // Arc grows then shrinks each cycle while the whole thing turns.
        const cycle = (now % (CIRCULAR_CYCLE * 2)) / CIRCULAR_CYCLE
        const grow = cycle < 1
        const t = standard(grow ? cycle : cycle - 1)
        const min = 0.1 * full
        const maxSweep = 0.75 * full
        const sweep = grow ? min + (maxSweep - min) * t : maxSweep - (maxSweep - min) * t
        const base = grow ? 0 : (maxSweep - min) * t
        const turn = ((now / 2000) * full) % full
        const start = turn + base
        active.current.setAttribute('d', arc(start, start + sweep, amplitude, offset))
        track.current.setAttribute('d', arc(start + sweep + gapAngle, start + full - gapAngle, 0, 0))
        return true
    }
    useFrames(draw, true, root, value)

    return (
        <div
            ref={root}
            role="progressbar"
            aria-label={label}
            aria-valuemin={determinate ? 0 : undefined}
            aria-valuemax={determinate ? 100 : undefined}
            aria-valuenow={determinate ? Math.round(clamp01(value) * 100) : undefined}
            data-wavy={wavy || undefined}
            className={cx(styles.circular, className)}
            style={{ ...style, '--md-progress-size': `${box}px` } as React.CSSProperties}
            {...rest}
        >
            <svg viewBox={`0 0 ${box} ${box}`} aria-hidden focusable="false">
                <path ref={track} className={styles.track} />
                <path ref={active} className={styles.active} />
            </svg>
        </div>
    )
}
