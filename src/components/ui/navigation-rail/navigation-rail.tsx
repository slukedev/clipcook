'use client'

import Link from 'next/link'
import { createContext, type ReactNode, use, useEffect, useState } from 'react'
import { Badge } from '../badge/badge'
import { cx } from '../cx'
import { ExtendedFab } from '../fab/fab'
import { IconButton } from '../icon-button/icon-button'
import { Glyph } from '../icon/glyph'
import { type NavItemProps, useNavSelected } from '../navigation-bar/navigation-bar'
import styles from './navigation-rail.module.scss'

const RailContext = createContext(false)

/** Whether the surrounding rail is expanded. */
export function useRailExpanded(): boolean {
    return use(RailContext)
}

export interface NavigationRailProps {
    expanded?: boolean
    defaultExpanded?: boolean
    onExpandedChange?: (expanded: boolean) => void
    /** Expanded rail floats over content with a scrim (compact and medium windows). */
    modal?: boolean
    /** Shows the menu button that expands and collapses the rail. */
    expandable?: boolean
    /** Usually a `RailFab`, which collapses with the rail. */
    fab?: ReactNode
    label?: string
    className?: string
    children: ReactNode
}

/** M3 navigation rail for medium and larger windows; replaces the navigation drawer. */
export function NavigationRail({
    expanded: controlled,
    defaultExpanded = false,
    onExpandedChange,
    modal = false,
    expandable = true,
    fab,
    label = 'Main',
    className,
    children,
}: NavigationRailProps) {
    const [uncontrolled, setUncontrolled] = useState(defaultExpanded)
    const expanded = controlled ?? uncontrolled
    const setExpanded = (next: boolean) => {
        setUncontrolled(next)
        onExpandedChange?.(next)
    }
    const floating = modal && expanded

    useEffect(() => {
        if (!floating) return
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setUncontrolled(false)
                onExpandedChange?.(false)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [floating, onExpandedChange])

    return (
        <RailContext value={expanded}>
            {floating && <div className={styles.placeholder} aria-hidden />}
            {floating && <div className={styles.scrim} onClick={() => setExpanded(false)} aria-hidden />}
            <nav
                aria-label={label}
                className={cx(styles.rail, className)}
                data-expanded={expanded || undefined}
                data-modal={modal || undefined}
            >
                <div className={styles.header}>
                    {expandable && (
                        <IconButton
                            label={expanded ? 'Collapse navigation' : 'Expand navigation'}
                            icon={<Glyph name={expanded ? 'menu_open' : 'menu'} />}
                            onClick={() => setExpanded(!expanded)}
                            aria-expanded={expanded}
                        />
                    )}
                    {fab}
                </div>
                <div className={styles.items}>{children}</div>
            </nav>
        </RailContext>
    )
}

export function NavigationRailItem({
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
                <span className={styles.innerLabel}>{label}</span>
            </span>
            <span className={styles.label}>{label}</span>
        </Link>
    )
}

export interface RailFabProps {
    icon: ReactNode
    label: string
    href?: string
    onClick?: () => void
}

/** The rail's FAB: an extended FAB while expanded, a plain FAB while collapsed. */
export function RailFab({ icon, label, href, onClick }: RailFabProps) {
    const expanded = useRailExpanded()
    return (
        <ExtendedFab
            icon={icon}
            collapsed={!expanded}
            lowered
            aria-label={expanded ? undefined : label}
            onClick={onClick}
            render={href ? <Link href={href} /> : undefined}
            nativeButton={!href}
        >
            {label}
        </ExtendedFab>
    )
}
