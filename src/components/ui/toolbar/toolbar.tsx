'use client'

import { Toolbar as BaseToolbar } from '@base-ui/react/toolbar'
import type { ComponentProps, ReactNode } from 'react'
import { cx } from '../cx'
import { IconButton, type IconButtonProps } from '../icon-button/icon-button'
import { useScrollHidden } from '../internal/use-scroll-hidden'
import styles from './toolbar.module.scss'

export interface ToolbarProps extends Omit<ComponentProps<typeof BaseToolbar.Root>, 'className'> {
    /** Floating sits above content as a pill; docked spans the bottom edge. */
    variant?: 'floating' | 'docked'
    /** Vibrant fills with primary container. */
    color?: 'standard' | 'vibrant'
    /** A FAB paired with a floating toolbar, 8dp away. */
    fab?: ReactNode
    /** Pin to the bottom center of the viewport (floating). */
    fixed?: boolean
    /** Slide away while scrolling down (floating). */
    hideOnScroll?: boolean
    /** Accessible name. */
    label: string
    className?: string
}

/** M3 Expressive toolbar with roving keyboard focus. Fill it with `ToolbarButton`. */
export function Toolbar({
    variant = 'floating',
    color = 'standard',
    orientation = 'horizontal',
    fab,
    fixed = false,
    hideOnScroll = false,
    label,
    className,
    children,
    ...rest
}: ToolbarProps) {
    const hidden = useScrollHidden(hideOnScroll && variant === 'floating')
    const bar = (
        <BaseToolbar.Root
            aria-label={label}
            orientation={orientation}
            className={cx(styles.toolbar, styles[variant], variant === 'docked' && className)}
            data-color={color}
            {...rest}
        >
            {children}
        </BaseToolbar.Root>
    )
    if (variant === 'docked') return bar
    return (
        <div
            className={cx(styles.wrap, className)}
            data-orientation={orientation}
            data-fixed={fixed || undefined}
            data-hidden={hidden || undefined}
        >
            {bar}
            {fab}
        </div>
    )
}

/** An IconButton wired into the toolbar's keyboard navigation. */
export function ToolbarButton(props: IconButtonProps) {
    return <BaseToolbar.Button render={<IconButton {...props} />} data-toolbar-item="" />
}

export function ToolbarSeparator() {
    return <BaseToolbar.Separator className={styles.separator} />
}

export const ToolbarGroup = BaseToolbar.Group
