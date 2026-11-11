'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useEffectEvent, useState } from 'react'
import { useThemePreference } from '@/components/theme/theme-provider'
import { ExtendedFab, FabMenu, FabMenuItem } from '@/components/ui/fab'
import { Menu, MenuContent, MenuLinkItem, MenuTrigger } from '@/components/ui/menu'
import { NavigationBar, NavigationBarItem } from '@/components/ui/navigation-bar'
import { NavigationRail, NavigationRailItem, useRailExpanded } from '@/components/ui/navigation-rail'
import { prefetchPage, whenIdle } from '@/lib/navigation/prefetch'
import styles from './app-shell.module.scss'
import { captureInstallPrompt } from './install-prompt'
import { RAIL_COOKIE, rememberTimeZone, takeLegacyMotion, writeCookie } from './preferences'

export interface Destination {
    href: string
    label: string
    icon: ReactNode
    selectedIcon: ReactNode
    /** Count shown on the destination (unchecked grocery items). */
    badge?: number
}

export interface ClipAction {
    href: string
    label: string
    icon: ReactNode
}

interface AppShellProps {
    destinations: Destination[]
    clipActions: ClipAction[]
    clipIcon: ReactNode
    /** The large-window rail starts expanded unless the user collapsed it (cookie). */
    railExpanded: boolean
    children: ReactNode
}

// Top-level destinations fade through (M3) and are prefetched whole, so switching tabs
// never shows a skeleton.
const DESTINATION_LINK = { prefetch: true, transitionTypes: ['nav-fade'] }
const SETTINGS_HREF = '/settings'

function badgeLabel(destination: Destination): string | undefined {
    if (!destination.badge) return undefined
    return `${destination.label}, ${destination.badge} to buy`
}

/**
 * Routes where Clip is the screen's main action, so the compact FAB shows. Collection
 * pages have their own "New collection" and "Add recipes" actions, and one FAB per
 * screen means a second plus there would read as one of those.
 */
function showsFab(pathname: string): boolean {
    return pathname === '/'
}

/**
 * Clipping and editing are focused tasks with their own close button, so the
 * compact navigation bar stays out of them from the first step to the last.
 */
function isFocusedTask(pathname: string): boolean {
    return pathname === '/clip' || pathname === '/new' || /^\/recipe\/[^/]+\/edit$/.test(pathname)
}

/**
 * Adaptive navigation: a navigation bar and FAB menu on compact windows, a
 * collapsed rail that expands as a modal on medium and expanded windows, and a
 * rail that expands in place on large windows. All three render on the server
 * and CSS shows one, so nothing shifts when the page hydrates.
 */
export function AppShell({ destinations, clipActions, clipIcon, railExpanded, children }: AppShellProps) {
    const pathname = usePathname()
    const router = useRouter()
    const [largeExpanded, setLargeExpanded] = useState(railExpanded)

    const { setMotion } = useThemePreference()
    const adoptLegacyMotion = useEffectEvent(() => {
        if (takeLegacyMotion()) setMotion('standard')
    })

    useEffect(() => {
        captureInstallPrompt()
        adoptLegacyMotion()
    }, [])

    // The server works out "today" for the meal plan from the browser's time zone.
    useEffect(() => {
        if (rememberTimeZone()) router.refresh()
    }, [router])

    // Link only refreshes an expired prefetch on hover, which touch screens never send.
    // Re-warm the other destinations after each navigation instead; fresh ones are reused.
    useEffect(
        () =>
            whenIdle(() => {
                for (const d of destinations) if (d.href !== pathname) prefetchPage(router, d.href)
            }),
        [pathname, destinations, router],
    )

    const railItems = destinations.map((d) => (
        <NavigationRailItem
            key={d.href}
            href={d.href}
            label={d.label}
            icon={d.icon}
            selectedIcon={d.selectedIcon}
            badge={d.badge || undefined}
            aria-label={badgeLabel(d)}
            {...DESTINATION_LINK}
        />
    ))
    const railFab = <ClipRailFab icon={clipIcon} actions={clipActions} />
    // Settings sits apart from the places you cook from, at the foot of the rail.
    const railMain = railItems.filter((_, i) => destinations[i]?.href !== SETTINGS_HREF)
    const railFooter = railItems.filter((_, i) => destinations[i]?.href === SETTINGS_HREF)
    const brand = <RailBrand />

    return (
        <div className={styles.shell}>
            <a href="#main" className={styles.skip}>
                Skip to content
            </a>
            <NavigationRail
                className={`${styles.railModal} cc-vt-rail`}
                modal
                brand={brand}
                fab={railFab}
                footer={railFooter}
            >
                {railMain}
            </NavigationRail>
            <NavigationRail
                className={`${styles.railLarge} cc-vt-rail-large`}
                expanded={largeExpanded}
                onExpandedChange={(next) => {
                    setLargeExpanded(next)
                    writeCookie(RAIL_COOKIE, next ? 'expanded' : 'collapsed')
                }}
                brand={brand}
                fab={railFab}
                footer={railFooter}
            >
                {railMain}
            </NavigationRail>
            <div className={styles.column}>
                <main id="main" tabIndex={-1} className={styles.main}>
                    {children}
                </main>
                {!isFocusedTask(pathname) && (
                    <NavigationBar className={`${styles.bar} cc-vt-bar`}>
                        {destinations.map((d) => (
                            <NavigationBarItem
                                key={d.href}
                                href={d.href}
                                label={d.label}
                                icon={d.icon}
                                selectedIcon={d.selectedIcon}
                                badge={d.badge || undefined}
                                aria-label={badgeLabel(d)}
                                {...DESTINATION_LINK}
                            />
                        ))}
                    </NavigationBar>
                )}
            </div>
            {showsFab(pathname) && (
                <div className={`${styles.fab} cc-vt-fab`} data-clip-fab="">
                    <FabMenu label="Clip a recipe" icon={clipIcon}>
                        {clipActions.map((action) => (
                            <FabMenuItem key={action.href} icon={action.icon} onClick={() => router.push(action.href)}>
                                {action.label}
                            </FabMenuItem>
                        ))}
                    </FabMenu>
                </div>
            )}
        </div>
    )
}

/** The rail's FAB opens the same three clip actions as the compact FAB menu. */
function ClipRailFab({ icon, actions }: { icon: ReactNode; actions: ClipAction[] }) {
    const expanded = useRailExpanded()
    return (
        <Menu>
            <MenuTrigger
                render={
                    <ExtendedFab icon={icon} collapsed={!expanded} lowered aria-label={expanded ? undefined : 'Clip'}>
                        Clip
                    </ExtendedFab>
                }
            />
            <MenuContent side="inline-end" align="start" sideOffset={8}>
                {actions.map((action) => (
                    <MenuLinkItem key={action.href} icon={action.icon} render={<Link href={action.href} />}>
                        {action.label}
                    </MenuLinkItem>
                ))}
            </MenuContent>
        </Menu>
    )
}

/**
 * The ClipCook mark, drawn in the active scheme so it follows the recipe colors with
 * the rest of the window, and the wordmark beside it while the rail is expanded.
 */
function RailBrand() {
    const expanded = useRailExpanded()
    // The wordmark fades in when the rail expands, never on page load.
    const [shown, setShown] = useState(expanded)
    const [toggled, setToggled] = useState(false)
    if (expanded !== shown) {
        setShown(expanded)
        setToggled(true)
    }
    return (
        <Link
            href="/"
            className={styles.brand}
            aria-label="ClipCook, library"
            data-toggled={toggled || undefined}
            {...DESTINATION_LINK}
        >
            <svg className={styles.mark} viewBox="0 0 100 100" aria-hidden focusable="false">
                <rect className={styles.markTile} width="100" height="100" rx="28" />
                <path
                    className={styles.markCookie}
                    transform="translate(17 22) scale(0.62)"
                    d="M39.8 6C45.6 0.8 54.4 0.8 60.2 6C63.1 8.7 67 10.1 71 9.9C78.8 9.6 85.5 15.3 86.6 23C87.1 27 89.2 30.5 92.3 33C98.5 37.7 100 46.4 95.8 53C93.7 56.4 93 60.4 93.8 64.3C95.5 71.9 91.1 79.6 83.7 82C79.9 83.2 76.7 85.8 74.9 89.3C71.2 96.2 63 99.2 55.7 96.3C52.1 94.8 47.9 94.8 44.3 96.3C37 99.2 28.8 96.2 25.1 89.3C23.3 85.8 20.1 83.2 16.3 82C8.9 79.6 4.5 71.9 6.2 64.3C7 60.4 6.3 56.4 4.2 53C0 46.4 1.5 37.7 7.7 33C10.8 30.5 12.9 27 13.4 23C14.5 15.3 21.2 9.6 29 9.9C33 10.1 36.9 8.7 39.8 6Z"
                />
                <circle className={styles.markSun} cx="69.5" cy="29.5" r="14.3" />
            </svg>
            {expanded && (
                <span className={styles.wordmark} aria-hidden>
                    ClipCook
                </span>
            )}
        </Link>
    )
}
