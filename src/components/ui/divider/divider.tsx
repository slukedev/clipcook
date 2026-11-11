import type { HTMLAttributes } from 'react'
import { cx } from '../cx'
import styles from './divider.module.scss'

export interface DividerProps extends HTMLAttributes<HTMLHRElement> {
    vertical?: boolean
    /** Inset from both edges by 16dp (lists). */
    inset?: boolean
}

/** Full-width (or full-height) separator line, never an edge of a container. */
export function Divider({ vertical = false, inset = false, className, ...rest }: DividerProps) {
    return (
        <hr
            aria-orientation={vertical ? 'vertical' : undefined}
            className={cx(styles.divider, className)}
            data-vertical={vertical || undefined}
            data-inset={inset || undefined}
            {...rest}
        />
    )
}
