'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { cx } from '../cx'
import styles from './top-app-bar.module.scss'

export interface TopAppBarProps {
    title: ReactNode
    subtitle?: ReactNode
    /** Small (64dp), medium flexible or large flexible. */
    variant?: 'small' | 'medium' | 'large'
    centered?: boolean
    /** Navigation button, usually an IconButton (back, menu). */
    leading?: ReactNode
    /** Up to three action IconButtons, or an avatar. */
    trailing?: ReactNode
    /** Heading element for the title; the page keeps one h1. */
    titleAs?: 'h1' | 'h2' | 'div'
    className?: string
}

/**
 * M3 top app bar. Pins a 64dp row; medium and large add an expanded title that
 * scrolls away under it. Window scroll drives the collapse.
 */
export function TopAppBar({
    title,
    subtitle,
    variant = 'small',
    centered = false,
    leading,
    trailing,
    titleAs: Heading = 'h1',
    className,
}: TopAppBarProps) {
    const rowRef = useRef<HTMLDivElement>(null)
    const expandedRef = useRef<HTMLDivElement>(null)
    const small = variant === 'small'

    useEffect(() => {
        if (CSS.supports('animation-timeline: scroll()')) return
        const row = rowRef.current
        if (!row) return
        let frame = 0
        const update = () => {
            const y = window.scrollY
            const threshold = expandedRef.current?.offsetHeight ?? 0
            row.toggleAttribute('data-scrolled', y > Math.max(0, threshold - 8))
            row.toggleAttribute('data-collapsed', y > threshold * 0.6)
        }
        const onScroll = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(update)
        }
        update()
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            window.removeEventListener('scroll', onScroll)
            cancelAnimationFrame(frame)
        }
    }, [])

    return (
        <header
            className={cx(styles.root, className)}
            data-variant={variant}
            data-centered={centered || undefined}
            data-subtitle={subtitle ? '' : undefined}
        >
            <div ref={rowRef} className={styles.row}>
                {leading && <div className={styles.leading}>{leading}</div>}
                <div className={styles.rowTitle} aria-hidden={small ? undefined : true}>
                    {small ? <Heading className={styles.smallTitle}>{title}</Heading> : <div className={styles.smallTitle}>{title}</div>}
                    {small && subtitle && <p className={styles.smallSubtitle}>{subtitle}</p>}
                </div>
                {trailing && <div className={styles.trailing}>{trailing}</div>}
            </div>
            {!small && (
                <div ref={expandedRef} className={styles.expanded}>
                    <Heading className={styles.title}>{title}</Heading>
                    {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                </div>
            )}
        </header>
    )
}
