'use client'

import Link from 'next/link'
import { cx } from '../cx'
import { Icon, type IconName } from '../icon'
import { Ripple } from '../ripple'
import styles from './button.module.scss'

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'elevated' | 'text'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant
    /** Leading Material Symbol. */
    icon?: IconName
    /** 56dp emphasized button for hero actions. */
    size?: 'default' | 'large'
    /** Renders as a next/link styled as a button. */
    href?: string
}

/**
 * M3 Expressive common button. Pill-shaped at rest, morphs toward a squarer
 * shape while pressed; ink ripple; tonal/elevated/outlined/text variants.
 */
export function Button({
    variant = 'filled',
    icon,
    size = 'default',
    href,
    type = 'button',
    className,
    children,
    ...props
}: ButtonProps) {
    const classes = cx(styles.button, styles[variant], size === 'large' && styles.large, className)
    const content = (
        <>
            {icon && <Icon name={icon} size={size === 'large' ? 24 : 20} className={styles.icon} />}
            <span className={styles.label}>{children}</span>
            <Ripple />
        </>
    )

    if (href) {
        return (
            <Link href={href} className={classes} aria-label={props['aria-label']}>
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
