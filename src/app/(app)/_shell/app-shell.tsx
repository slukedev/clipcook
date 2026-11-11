'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'
import { ExtendedFab, FabMenu, FabMenuItem } from '@/components/ui/fab'
import { Menu, MenuContent, MenuLinkItem, MenuTrigger } from '@/components/ui/menu'
import { NavigationBar, NavigationBarItem } from '@/components/ui/navigation-bar'
import { NavigationRail, NavigationRailItem, useRailExpanded } from '@/components/ui/navigation-rail'
import { captureInstallPrompt } from './install-prompt'
import { applyMotion, RAIL_COOKIE, readMotion, writeCookie } from './preferences'
import styles from './app-shell.module.scss'

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

function badgeLabel(destination: Destination): string | undefined {
    if (!destination.badge) return undefined
    return `${destination.label}, ${destination.badge} to buy`
}

/** Routes where Clip is the screen's main action, so the compact FAB shows. */
function showsFab(pathname: string): boolean {
    return pathname === '/' || pathname === '/collections' || pathname.startsWith('/collections/')
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

    useEffect(() => {
        captureInstallPrompt()
        applyMotion(readMotion())
    }, [])

    const railItems = destinations.map((d) => (
        <NavigationRailItem
            key={d.href}
            href={d.href}
            label={d.label}
            icon={d.icon}
            selectedIcon={d.selectedIcon}
            badge={d.badge || undefined}
            aria-label={badgeLabel(d)}
        />
    ))
    const railFab = <ClipRailFab icon={clipIcon} actions={clipActions} />

    return (
        <div className={styles.shell}>
            <a href="#main" className={styles.skip}>
                Skip to content
            </a>
            <NavigationRail className={styles.railModal} modal fab={railFab}>
                {railItems}
            </NavigationRail>
            <NavigationRail
                className={styles.railLarge}
                expanded={largeExpanded}
                onExpandedChange={(next) => {
                    setLargeExpanded(next)
                    writeCookie(RAIL_COOKIE, next ? 'expanded' : 'collapsed')
                }}
                fab={railFab}
            >
                {railItems}
            </NavigationRail>
            <div className={styles.column}>
                <main id="main" tabIndex={-1} className={styles.main}>
                    {children}
                </main>
                <NavigationBar className={styles.bar}>
                    {destinations.map((d) => (
                        <NavigationBarItem
                            key={d.href}
                            href={d.href}
                            label={d.label}
                            icon={d.icon}
                            selectedIcon={d.selectedIcon}
                            badge={d.badge || undefined}
                            aria-label={badgeLabel(d)}
                        />
                    ))}
                </NavigationBar>
            </div>
            {showsFab(pathname) && (
                <div className={styles.fab} data-clip-fab="">
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
