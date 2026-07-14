'use client'

import Link from 'next/link'
import { cx } from '../cx'
import { Ripple } from '../ripple'
import styles from './card.module.scss'

export type CardVariant = 'elevated' | 'filled' | 'outlined'

interface CardProps {
    variant?: CardVariant
    /** Renders as a next/link — makes the whole card clickable. */
    href?: string
    /** Renders as a button. */
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    className?: string
    children: React.ReactNode
    'aria-label'?: string
}

/**
 * M3 card. Static container by default; pass `href` or `onClick`
 * to make the whole card an interactive surface with ripple.
 */
export function Card({ variant = 'elevated', href, onClick, className, children, ...rest }: CardProps) {
    const classes = cx(styles.card, styles[variant], className)

    if (href) {
        return (
            <Link href={href} className={cx(classes, styles.interactive)} {...rest}>
                {children}
                <Ripple />
            </Link>
        )
    }

    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={cx(classes, styles.interactive)} {...rest}>
                {children}
                <Ripple />
            </button>
        )
    }

    return (
        <div className={classes} {...rest}>
            {children}
        </div>
    )
}
