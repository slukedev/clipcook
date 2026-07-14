'use client'

import Link from 'next/link'
import { cx } from '../cx'
import { Ripple } from '../ripple'
import styles from './list-item.module.scss'

interface ListItemProps {
    leading?: React.ReactNode
    headline: React.ReactNode
    supportingText?: React.ReactNode
    trailing?: React.ReactNode
    href?: string
    onClick?: React.MouseEventHandler<HTMLElement>
    className?: string
    'aria-label'?: string
}

/**
 * M3 list item (one or two lines). Interactive with ripple when
 * `href` or `onClick` is provided.
 */
export function ListItem({ leading, headline, supportingText, trailing, href, onClick, ...rest }: ListItemProps) {
    const { className, ...attrs } = rest
    const classes = cx(styles.item, supportingText ? styles.twoLine : undefined, className)

    const content = (
        <>
            {leading && <span className={styles.leading}>{leading}</span>}
            <span className={styles.body}>
                <span className={styles.headline}>{headline}</span>
                {supportingText && <span className={styles.supporting}>{supportingText}</span>}
            </span>
            {trailing && <span className={styles.trailing}>{trailing}</span>}
        </>
    )

    if (href) {
        return (
            <Link href={href} className={cx(classes, styles.interactive)} {...attrs}>
                {content}
                <Ripple />
            </Link>
        )
    }

    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={cx(classes, styles.interactive)} {...attrs}>
                {content}
                <Ripple />
            </button>
        )
    }

    return (
        <div className={classes} {...attrs}>
            {content}
        </div>
    )
}
