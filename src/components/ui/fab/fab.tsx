'use client'

import { Button as BaseButton } from '@base-ui/react/button'
import { Menu as BaseMenu } from '@base-ui/react/menu'
import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import { cx } from '../cx'
import { linkSemantics } from '../internal/link-semantics'
import { Glyph } from '../icon/glyph'
import { useScrollHidden } from '../internal/use-scroll-hidden'
import { Ripple } from '../ripple/ripple'
import styles from './fab.module.scss'

export type FabColor = 'primary' | 'secondary' | 'tertiary'

interface FabBase extends Omit<ComponentProps<typeof BaseButton>, 'className' | 'children' | 'color'> {
    icon: ReactNode
    color?: FabColor
    /** Solid primary/secondary/tertiary instead of the container color. */
    vibrant?: boolean
    /** Level 1 instead of level 3, for FABs that sit on a surface. */
    lowered?: boolean
    className?: string
}

export interface FabProps extends FabBase {
    /** Accessible name. */
    label: string
    size?: 'small' | 'default' | 'medium' | 'large'
}

/** M3 FAB. Small is deprecated in Expressive; prefer default, medium or large. */
export function Fab({
    icon,
    label,
    color = 'primary',
    vibrant,
    lowered,
    size = 'default',
    className,
    ...rest
}: FabProps) {
    return (
        <BaseButton
            aria-label={label}
            className={cx(styles.fab, styles[color], className)}
            data-size={size}
            data-vibrant={vibrant || undefined}
            data-lowered={lowered || undefined}
            {...rest}
            {...linkSemantics(rest.render, rest.role)}
        >
            <Ripple />
            <span className={styles.icon}>{icon}</span>
        </BaseButton>
    )
}

export interface ExtendedFabProps extends FabBase {
    children: ReactNode
    size?: 'small' | 'medium' | 'large'
    /** Show only the icon. */
    collapsed?: boolean
    /** Collapse while the page scrolls down, expand when it scrolls back up. */
    collapseOnScroll?: boolean
}

/** Extended FAB with a label; can collapse into a FAB. */
export function ExtendedFab({
    icon,
    children,
    color = 'primary',
    vibrant,
    lowered,
    size = 'small',
    collapsed,
    collapseOnScroll = false,
    className,
    ...rest
}: ExtendedFabProps) {
    const scrolled = useScrollHidden(collapseOnScroll && collapsed === undefined)
    const isCollapsed = collapsed ?? scrolled
    const height = size === 'large' ? '96px' : size === 'medium' ? '80px' : '56px'
    return (
        <BaseButton
            className={cx(styles.fab, styles.extended, styles[color], className)}
            data-size={size}
            data-vibrant={vibrant || undefined}
            data-lowered={lowered || undefined}
            data-collapsed={isCollapsed || undefined}
            style={{ '--_h': height } as CSSProperties}
            {...rest}
            {...linkSemantics(rest.render, rest.role)}
        >
            <Ripple />
            <span className={styles.icon}>{icon}</span>
            <span className={styles.label}>
                <span>{children}</span>
            </span>
        </BaseButton>
    )
}

export interface FabMenuItemProps extends Omit<ComponentProps<typeof BaseMenu.Item>, 'className' | 'children'> {
    icon?: ReactNode
    children: ReactNode
    className?: string
}

export interface FabMenuProps {
    /** Accessible name for the toggle. */
    label: string
    icon: ReactNode
    size?: 'default' | 'medium' | 'large'
    /** `FabMenuItem` elements, top to bottom. */
    children: ReactNode
    className?: string
}

/** FAB menu: the FAB morphs into a close button and actions stagger out above it. */
export function FabMenu({ label, icon, size = 'default', children, className }: FabMenuProps) {
    const items = Array.isArray(children) ? children : [children]
    return (
        <BaseMenu.Root>
            <BaseMenu.Trigger
                aria-label={label}
                className={cx(styles.fab, styles.primary, styles.toggle, className)}
                data-size={size}
            >
                <Ripple />
                <span className={styles.icon}>
                    <span className={styles.openIcon}>{icon}</span>
                    <Glyph name="close" className={styles.closeIcon} />
                </span>
            </BaseMenu.Trigger>
            <BaseMenu.Portal>
                <BaseMenu.Positioner className={styles.menuPositioner} side="top" align="end" sideOffset={8}>
                    <BaseMenu.Popup className={styles.menuPopup}>
                        {items.map((item, index) => (
                            // Items nearest the toggle arrive first.
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: static, ordered children
                                key={index}
                                style={{ '--_order': items.length - 1 - index, display: 'contents' } as CSSProperties}
                            >
                                {item}
                            </div>
                        ))}
                    </BaseMenu.Popup>
                </BaseMenu.Positioner>
            </BaseMenu.Portal>
        </BaseMenu.Root>
    )
}

export function FabMenuItem({ icon, children, className, ...rest }: FabMenuItemProps) {
    return (
        <BaseMenu.Item className={cx(styles.menuItem, className)} {...rest}>
            {icon}
            {children}
        </BaseMenu.Item>
    )
}
