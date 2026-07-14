'use client'

import { useEffect, useState } from 'react'
import { cx } from '../cx'
import styles from './top-app-bar.module.scss'

interface TopAppBarProps {
    leading?: React.ReactNode
    title: React.ReactNode
    trailing?: React.ReactNode
    className?: string
}

/**
 * M3 small top app bar. Sticky; gains a surface-container tint once the
 * page is scrolled (on-scroll elevation).
 */
export function TopAppBar({ leading, title, trailing, className }: TopAppBarProps) {
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 4)
        onScroll()
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    return (
        <header className={cx(styles.bar, scrolled && styles.scrolled, className)}>
            {leading && <div className={styles.leading}>{leading}</div>}
            <div className={styles.title}>{title}</div>
            {trailing && <div className={styles.trailing}>{trailing}</div>}
        </header>
    )
}
