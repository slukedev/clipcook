'use client'

import { type CSSProperties, useEffect, useRef } from 'react'
import { useReducedMotion, useSpringSpec } from '@/lib/motion'
import type { SpringToken } from '@/lib/theme/springs'
import { springAt } from '@/lib/theme/springs'
import { cx } from '../cx'
import { lerpPoints, type Points, pointsToPath, shapePoints } from './geometry'
import styles from './shape.module.scss'
import type { ShapeName } from './shape-paths'

export interface MorphShapeProps {
    /** The shape to show. Changing it morphs from wherever the outline is now. */
    shape: ShapeName
    size?: number | string
    /** Spring that drives the morph. */
    spring?: SpringToken
    className?: string
    style?: CSSProperties
    label?: string
}

/** A MaterialShape that springs into a new shape whenever `shape` changes. */
export function MorphShape({ shape, size, spring = 'spatial-default', className, style, label }: MorphShapeProps) {
    const pathRef = useRef<SVGPathElement>(null)
    const current = useRef<Points | null>(null)
    const spec = useSpringSpec(spring)
    const reduce = useReducedMotion()

    useEffect(() => {
        const path = pathRef.current
        const target = shapePoints(shape)
        const from = current.current
        if (!path || !from || reduce) {
            current.current = target
            path?.setAttribute('d', pointsToPath(target))
            return
        }
        let frame = 0
        let start = -1
        const tick = (now: number) => {
            // The first frame's timestamp is t = 0, so every frame after it moves.
            if (start < 0) start = now
            const elapsed = (now - start) / 1000
            const t = springAt(elapsed, spec)
            const points = lerpPoints(from, target, t)
            current.current = points
            path.setAttribute('d', pointsToPath(points))
            if (elapsed < 1.2) frame = requestAnimationFrame(tick)
            else current.current = target
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [shape, spec, reduce])

    const sized =
        size === undefined
            ? style
            : ({ ...style, '--md-shape-size': typeof size === 'number' ? `${size}px` : size } as CSSProperties)
    return (
        <svg
            viewBox="0 0 100 100"
            role={label ? 'img' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
            focusable="false"
            className={cx(styles.shape, className)}
            style={sized}
        >
            <path ref={pathRef} d={pointsToPath(shapePoints(shape))} />
        </svg>
    )
}
