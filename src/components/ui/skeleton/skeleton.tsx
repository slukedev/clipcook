import type { CSSProperties, HTMLAttributes } from 'react'
import { cx } from '../cx'
import styles from './skeleton.module.scss'

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
    /** CSS length or px. Defaults to the full available width. */
    width?: number | string
    /** CSS length or px. Text skeletons default to one line of the inherited type. */
    height?: number | string
    /** `text` lines take the font's line height; `circle`/`pill` round off; or a corner token. */
    shape?: 'text' | 'rect' | 'circle' | 'pill' | 'small' | 'medium' | 'large' | 'extra-large'
    /** Several text lines; the last one is shorter. */
    lines?: number
}

const len = (v: number | string | undefined) => (typeof v === 'number' ? `${v}px` : v)

/**
 * Placeholder that matches the real layout. Decorative: mark the region that is
 * loading with `aria-busy` instead.
 */
export function Skeleton({ width, height, shape = 'rect', lines, className, style, ...rest }: SkeletonProps) {
    if (lines && lines > 1) {
        return (
            <span className={cx(styles.lines, className)} style={style} aria-hidden {...rest}>
                {Array.from({ length: lines }, (_, i) => (
                    <span
                        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                        key={i}
                        className={styles.skeleton}
                        data-shape="text"
                        style={{ inlineSize: i === lines - 1 ? '60%' : len(width) } as CSSProperties}
                    />
                ))}
            </span>
        )
    }
    return (
        <span
            className={cx(styles.skeleton, className)}
            data-shape={shape}
            style={{ ...style, inlineSize: len(width), blockSize: len(height) }}
            aria-hidden
            {...rest}
        />
    )
}
