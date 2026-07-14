'use client'

import { cx } from '../cx'
import { Icon, type IconName } from '../icon'
import { Ripple } from '../ripple'
import styles from './icon-button.module.scss'

export type IconButtonVariant = 'standard' | 'filled' | 'tonal' | 'outlined'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: IconName
    /** Accessible name — icon buttons have no visible label. */
    label: string
    variant?: IconButtonVariant
    /** Toggle state; renders the filled icon glyph and selected colors. */
    selected?: boolean
}

/**
 * M3 icon button: 40dp visual, 48dp touch target, all four variants,
 * optional toggle behavior (pass `selected` and handle onClick).
 */
export function IconButton({
    icon,
    label,
    variant = 'standard',
    selected,
    type = 'button',
    className,
    ...props
}: IconButtonProps) {
    return (
        <button
            type={type}
            aria-label={label}
            title={label}
            aria-pressed={selected}
            className={cx(styles.iconButton, styles[variant], selected && styles.selected, className)}
            {...props}
        >
            <Icon name={icon} filled={selected} />
            <Ripple />
        </button>
    )
}
