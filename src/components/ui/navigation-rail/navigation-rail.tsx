'use client'

import Link from 'next/link'
import { createContext, type ReactNode, use, useEffect, useRef, useState } from 'react'
import { Badge } from '../badge/badge'
import { cx } from '../cx'
import { ExtendedFab } from '../fab/fab'
import { IconButton } from '../icon-button/icon-button'
import { Glyph } from '../icon/glyph'
import { type NavItemProps, useNavSelected } from '../navigation-bar/navigation-bar'
import styles from './navigation-rail.module.scss'

const RailContext = createContext(false)

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

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
    // Labels fade in when the rail changes width, never on page load: primary
    // navigation text starts visible.
    const [shownExpanded, setShownExpanded] = useState(expanded)
    const [toggled, setToggled] = useState(false)
    if (expanded !== shownExpanded) {
        setShownExpanded(expanded)
        setToggled(true)
    }
    const navRef = useRef<HTMLElement>(null)
    const menuRef = useRef<HTMLButtonElement>(null)

    // The floating rail is modal: Tab cycles inside it, Escape closes it, and focus
    // goes back to the menu button when it closes.
    useEffect(() => {
        if (!floating) return
        const nav = navRef.current
        if (!nav) return
        const close = () => {
            setUncontrolled(false)
            onExpandedChange?.(false)
        }
        const focusables = () =>
            [...nav.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0)
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                close()
                return
            }
            if (event.key !== 'Tab') return
            const list = focusables()
            const first = list[0]
            const last = list[list.length - 1]
            if (!first || !last) return
            const current = document.activeElement
            if (event.shiftKey && (current === first || !nav.contains(current))) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && (current === last || !nav.contains(current))) {
                event.preventDefault()
                first.focus()
            }
        }
        // Picking a destination closes the floating rail, like a modal drawer.
        const onClick = (event: MouseEvent) => {
            if (event.target instanceof Element && event.target.closest('a[href]')) close()
        }
        const onFocusIn = (event: FocusEvent) => {
            if (event.target instanceof Node && !nav.contains(event.target)) focusables()[0]?.focus()
        }
        if (!nav.contains(document.activeElement)) focusables()[0]?.focus()
        document.addEventListener('keydown', onKey)
        document.addEventListener('focusin', onFocusIn)
        nav.addEventListener('click', onClick)
        return () => {
            nav.removeEventListener('click', onClick)
            document.removeEventListener('keydown', onKey)
            document.removeEventListener('focusin', onFocusIn)
            const active = document.activeElement
            if (!active || active === document.body || nav.contains(active)) menuRef.current?.focus()
        }
    }, [floating, onExpandedChange])

    return (
        <RailContext value={expanded}>
            {floating && <div className={styles.placeholder} aria-hidden />}
            {floating && <div className={styles.scrim} onClick={() => setExpanded(false)} aria-hidden />}
            <nav
                ref={navRef}
                aria-label={label}
                className={cx(styles.rail, className)}
                data-expanded={expanded || undefined}
                data-toggled={toggled || undefined}
                data-modal={modal || undefined}
            >
                <div className={styles.header}>
                    {expandable && (
                        <IconButton
                            ref={menuRef}
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
    const expanded = useRailExpanded()
    const count = typeof badge === 'number' ? badge : undefined
    // A count beside the expanded label sits at the end of the pill; dots stay on the icon.
    const trailingCount = expanded && count !== undefined
    return (
        <Link href={href} aria-current={active ? 'page' : undefined} className={cx(styles.item, className)} {...rest}>
            <span className={styles.indicator}>
                <span className={styles.icons}>
                    {active && selectedIcon ? selectedIcon : icon}
                    {badge !== undefined && badge !== false && !trailingCount && (
                        <Badge className={styles.badge} value={count} />
                    )}
                </span>
                <span className={styles.innerLabel}>{label}</span>
                {trailingCount && <Badge className={styles.trailingBadge} value={count} />}
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
