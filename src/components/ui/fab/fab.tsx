'use client'

import Link from 'next/link'
import { cx } from '../cx'
import { Icon, type IconName } from '../icon'
import { Ripple } from '../ripple'
import styles from './fab.module.scss'

interface FabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: IconName
    /** Extended FAB label. Without it, pass aria-label. */
    label?: string
    size?: 'default' | 'large'
    color?: 'primary' | 'secondary' | 'tertiary'
    /** Renders as a next/link styled as a FAB. */
    href?: string
}

/**
 * M3 Expressive FAB — tonal container, shape morphs rounder on press.
 * Pass `label` for the extended variant.
 */
export function Fab({
    icon,
    label,
    size = 'default',
    color = 'primary',
    href,
    className,
    type = 'button',
    ...props
}: FabProps) {
    const classes = cx(styles.fab, styles[color], size === 'large' && styles.large, label && styles.extended, className)
    const content = (
        <>
            <Icon name={icon} size={size === 'large' ? 36 : 24} />
            {label && <span className={styles.label}>{label}</span>}
            <Ripple />
        </>
    )

    if (href) {
        return (
            <Link href={href} className={classes} aria-label={props['aria-label'] ?? label}>
                {content}
            </Link>
        )
    }

    return (
        <button type={type} className={classes} {...props}>
            {content}
        </button>
    )
}
