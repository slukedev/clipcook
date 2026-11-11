'use client'

import { type HTMLAttributes, useEffect, useRef } from 'react'
import { useReducedMotion } from '@/lib/motion'
import { springAt } from '@/lib/theme/springs'
import { cx } from '../cx'
import { lerpPoints, type Points, pointsToPath, shapePoints } from '../shape/geometry'
import type { ShapeName } from '../shape/shape-paths'
import styles from './loading-indicator.module.scss'

// LoadingIndicator.kt: the indeterminate sequence, a morph every 650ms on a
// (0.6, 200) spring, a quarter turn per morph and a full turn every 4666ms.
const SEQUENCE: ShapeName[] = ['soft-burst', 'cookie9', 'pentagon', 'pill', 'sunny', 'cookie4', 'oval']
const MORPH_MS = 650
const MORPH_SPRING = { damping: 0.6, stiffness: 200 }
// Active shape is 38dp inside the 48dp container.
const ACTIVE_SCALE = 38 / 48

let fit = 0
/** One shared scale so no shape pokes out of the circle while it spins. */
function fitScale(): number {
    if (fit) return fit
    let max = 0
    for (const name of [...SEQUENCE, 'circle' as const]) {
        const p = shapePoints(name)
        for (let k = 0; k < p.length; k += 2) {
            max = Math.max(max, Math.hypot((p[k] as number) - 50, (p[k + 1] as number) - 50))
        }
    }
    fit = (50 / max) * ACTIVE_SCALE
    return fit
}

export interface LoadingIndicatorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
    /** Filled circle behind the shape, for use over busy content. */
    contained?: boolean
    /** 0 to 1 for determinate progress; omit while the duration is unknown. */
    value?: number
    /** Container size in px. M3 default is 48. */
    size?: number
    /** Accessible name. */
    label?: string
}

/** M3 Expressive loading indicator: MaterialShapes morphing for waits under five seconds. */
export function LoadingIndicator({
    contained = false,
    value,
    size = 48,
    label = 'Loading',
    className,
    style,
    ...rest
}: LoadingIndicatorProps) {
    const pathRef = useRef<SVGPathElement>(null)
    const rootRef = useRef<HTMLDivElement>(null)
    const reduce = useReducedMotion()
    const determinate = value !== undefined

    useEffect(() => {
        const path = pathRef.current
        if (!path || determinate) return
        const scale = fitScale()
        const shapes = SEQUENCE.map(shapePoints)
        if (reduce) {
            path.setAttribute('d', pointsToPath(shapes[0] as Points, scale))
            return
        }
        let frame = 0
        let visible = true
        let origin = performance.now()
        const tick = (now: number) => {
            const elapsed = Math.max(0, now - origin)
            const index = Math.floor(elapsed / MORPH_MS)
            const local = (elapsed - index * MORPH_MS) / 1000
            const progress = springAt(local, MORPH_SPRING)
            const from = shapes[index % shapes.length] as Points
            const to = shapes[(index + 1) % shapes.length] as Points
            path.setAttribute('d', pointsToPath(lerpPoints(from, to, progress), scale))
            path.setAttribute('transform', `rotate(${(index + progress) * 90} 50 50)`)
            if (visible) frame = requestAnimationFrame(tick)
        }
        const observer = new IntersectionObserver(([entry]) => {
            const next = entry?.isIntersecting ?? true
            if (next && !visible) {
                origin = performance.now()
                frame = requestAnimationFrame(tick)
            }
            visible = next
        })
        if (rootRef.current) observer.observe(rootRef.current)
        frame = requestAnimationFrame(tick)
        return () => {
            cancelAnimationFrame(frame)
            observer.disconnect()
        }
    }, [determinate, reduce])

    let initial: string
    let transform: string | undefined
    if (determinate) {
        const p = Math.min(1, Math.max(0, value))
        initial = pointsToPath(lerpPoints(shapePoints('circle'), shapePoints('soft-burst'), p), fitScale())
        transform = `rotate(${18 - 180 * p} 50 50)`
    } else {
        initial = pointsToPath(shapePoints(SEQUENCE[0] as ShapeName), fitScale())
    }

    return (
        <div
            ref={rootRef}
            role="progressbar"
            aria-label={label}
            aria-valuemin={determinate ? 0 : undefined}
            aria-valuemax={determinate ? 100 : undefined}
            aria-valuenow={determinate ? Math.round(value * 100) : undefined}
            data-contained={contained || undefined}
            data-indeterminate={determinate ? undefined : ''}
            className={cx(styles.root, className)}
            style={{ ...style, '--md-loading-size': `${size}px` } as React.CSSProperties}
            {...rest}
        >
            <svg viewBox="0 0 100 100" className={styles.svg} aria-hidden focusable="false">
                <path ref={pathRef} d={initial} transform={transform} className={styles.indicator} />
            </svg>
        </div>
    )
}
