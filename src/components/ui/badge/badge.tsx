import type { HTMLAttributes } from 'react'
import { cx } from '../cx'
import styles from './badge.module.scss'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    /** Count to show; omit for a small dot. Above `max` shows `max+`. */
    value?: number
    max?: number
    /** Accessible text, e.g. "3 new". Hidden from assistive tech when omitted. */
    label?: string
}

/** M3 badge: 6dp dot or 16dp count pill in error colors. */
export function Badge({ value, max = 999, label, className, ...rest }: BadgeProps) {
    const text = value === undefined ? undefined : value > max ? `${max}+` : String(value)
    return (
        <span
            className={cx(styles.badge, className)}
            data-large={text !== undefined || undefined}
            role="img"
            aria-label={label}
            aria-hidden={label ? undefined : true}
            {...rest}
        >
            {text}
        </span>
    )
}
