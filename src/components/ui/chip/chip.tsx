'use client'

import { cx } from '../cx'
import { Icon, type IconName } from '../icon'
import { Ripple } from '../ripple'
import styles from './chip.module.scss'

interface ChipProps {
    /** Leading icon; replaced by a check when `selected`. */
    icon?: IconName
    /** Filter-chip selected state. */
    selected?: boolean
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    disabled?: boolean
    className?: string
    children: React.ReactNode
}

/**
 * M3 chip. Static assist chip by default; pass `onClick` for an
 * interactive chip and `selected` for filter behavior.
 */
export function Chip({ icon, selected = false, onClick, disabled, className, children }: ChipProps) {
    const leadingIcon = selected ? 'check' : icon
    const content = (
        <>
            {leadingIcon && <Icon name={leadingIcon} size={20} className={styles.icon} />}
            <span>{children}</span>
        </>
    )
    const classes = cx(styles.chip, selected && styles.selected, leadingIcon && styles.withIcon, className)

    if (!onClick) {
        return <span className={classes}>{content}</span>
    }

    return (
        <button
            type="button"
            className={cx(classes, styles.interactive)}
            onClick={onClick}
            disabled={disabled}
            aria-pressed={selected}
        >
            {content}
            <Ripple />
        </button>
    )
}
