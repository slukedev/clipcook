'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentProps, ReactNode } from 'react'
import { Badge } from '../badge/badge'
import { cx } from '../cx'
import styles from './navigation-bar.module.scss'

export interface NavigationBarProps extends ComponentProps<'nav'> {
    /** Accessible name for the landmark. */
    label?: string
}

/** Flexible navigation bar for compact and medium windows. 3 to 5 `NavigationBarItem`s. */
export function NavigationBar({ label = 'Main', className, children, ...rest }: NavigationBarProps) {
    return (
        <nav aria-label={label} className={cx(styles.bar, className)} {...rest}>
            {children}
        </nav>
    )
}

export interface NavItemProps extends Omit<ComponentProps<typeof Link>, 'children'> {
    href: string
    icon: ReactNode
    /** Filled glyph for the selected state. */
    selectedIcon?: ReactNode
    label: string
    /** Overrides matching `href` against the current path. */
    selected?: boolean
    /** Count, or `true` for a dot. */
    badge?: number | boolean
}

/** Selected when the path is `href` or below it (`/` only matches itself). */
export function useNavSelected(href: string, selected?: boolean): boolean {
    const pathname = usePathname()
    if (selected !== undefined) return selected
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(`${href}/`)
}

export function NavigationBarItem({
    href,
    icon,
    selectedIcon,
    label,
    selected,
    badge,
    className,
    ...rest
}: NavItemProps) {
    const active = useNavSelected(href, selected)
    return (
        <Link href={href} aria-current={active ? 'page' : undefined} className={cx(styles.item, className)} {...rest}>
            <span className={styles.indicator}>
                <span className={styles.icons}>
                    {active && selectedIcon ? selectedIcon : icon}
                    {badge !== undefined && badge !== false && (
                        <Badge className={styles.badge} value={badge === true ? undefined : badge} />
                    )}
                </span>
                <span className={cx(styles.label, styles.innerLabel)}>{label}</span>
            </span>
            <span className={cx(styles.label, styles.outerLabel)}>{label}</span>
        </Link>
    )
}
