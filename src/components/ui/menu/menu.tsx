'use client'

import { Menu as BaseMenu } from '@base-ui/react/menu'
import type { ComponentProps, ReactNode } from 'react'
import { cx } from '../cx'
import { Glyph } from '../icon/glyph'
import styles from './menu.module.scss'

/** Menu state root. Holds a `MenuTrigger` and a `MenuContent`. */
export const Menu = BaseMenu.Root

/**
 * The element that opens the menu. Pass a design-system button with
 * `render={<IconButton label="More" icon={...} />}` to keep its look.
 */
export const MenuTrigger = BaseMenu.Trigger

export interface MenuContentProps extends Omit<ComponentProps<typeof BaseMenu.Popup>, 'className'> {
    className?: string
    side?: ComponentProps<typeof BaseMenu.Positioner>['side']
    align?: ComponentProps<typeof BaseMenu.Positioner>['align']
    sideOffset?: number
}

/** Portal, positioner and popup in one. Scales out of its trigger. */
export function MenuContent({
    side = 'bottom',
    align = 'start',
    sideOffset = 4,
    className,
    children,
    ...rest
}: MenuContentProps) {
    return (
        <BaseMenu.Portal>
            <BaseMenu.Positioner
                className={styles.positioner}
                side={side}
                align={align}
                sideOffset={sideOffset}
                collisionPadding={8}
            >
                <BaseMenu.Popup className={cx(styles.popup, className)} {...rest}>
                    {children}
                </BaseMenu.Popup>
            </BaseMenu.Positioner>
        </BaseMenu.Portal>
    )
}

interface ItemSlots {
    /** Leading icon element. */
    icon?: ReactNode
    /** Trailing text, such as a shortcut, or an icon. */
    trailing?: ReactNode
    children: ReactNode
    className?: string
}

export interface MenuItemProps extends ItemSlots, Omit<ComponentProps<typeof BaseMenu.Item>, 'children' | 'className'> {
    /** Marks the current choice (tertiary container, rounder shape). */
    selected?: boolean
}

function Slots({ icon, trailing, children }: Omit<ItemSlots, 'className'>) {
    return (
        <>
            {icon && <span className={styles.leading}>{icon}</span>}
            <span className={styles.label}>{children}</span>
            {trailing && <span className={styles.trailing}>{trailing}</span>}
        </>
    )
}

export function MenuItem({ icon, trailing, selected, children, className, ...rest }: MenuItemProps) {
    return (
        <BaseMenu.Item className={cx(styles.item, className)} data-selected={selected ? '' : undefined} {...rest}>
            <Slots icon={icon} trailing={trailing}>
                {children}
            </Slots>
        </BaseMenu.Item>
    )
}

export interface MenuLinkItemProps
    extends ItemSlots,
        Omit<ComponentProps<typeof BaseMenu.LinkItem>, 'children' | 'className'> {}

/** A menu item that navigates. Use `render={<Link href="..." />}` for client routing. */
export function MenuLinkItem({ icon, trailing, children, className, ...rest }: MenuLinkItemProps) {
    return (
        <BaseMenu.LinkItem className={cx(styles.item, className)} {...rest}>
            <Slots icon={icon} trailing={trailing}>
                {children}
            </Slots>
        </BaseMenu.LinkItem>
    )
}

export interface MenuCheckboxItemProps
    extends Omit<ItemSlots, 'trailing'>,
        Omit<ComponentProps<typeof BaseMenu.CheckboxItem>, 'children' | 'className'> {}

export function MenuCheckboxItem({ icon, children, className, ...rest }: MenuCheckboxItemProps) {
    return (
        <BaseMenu.CheckboxItem className={cx(styles.item, className)} closeOnClick={false} {...rest}>
            {icon && <span className={styles.leading}>{icon}</span>}
            <span className={styles.label}>{children}</span>
            <BaseMenu.CheckboxItemIndicator className={styles.indicator}>
                <Glyph name="check" size={20} />
            </BaseMenu.CheckboxItemIndicator>
        </BaseMenu.CheckboxItem>
    )
}

export const MenuRadioGroup = BaseMenu.RadioGroup

export interface MenuRadioItemProps
    extends Omit<ItemSlots, 'trailing'>,
        Omit<ComponentProps<typeof BaseMenu.RadioItem>, 'children' | 'className'> {}

export function MenuRadioItem({ icon, children, className, ...rest }: MenuRadioItemProps) {
    return (
        <BaseMenu.RadioItem className={cx(styles.item, className)} {...rest}>
            {icon && <span className={styles.leading}>{icon}</span>}
            <span className={styles.label}>{children}</span>
            <BaseMenu.RadioItemIndicator className={styles.indicator}>
                <Glyph name="check" size={20} />
            </BaseMenu.RadioItemIndicator>
        </BaseMenu.RadioItem>
    )
}

export function MenuGroup({ label, children }: { label?: string; children: ReactNode }) {
    return (
        <BaseMenu.Group>
            {label && <BaseMenu.GroupLabel className={styles.groupLabel}>{label}</BaseMenu.GroupLabel>}
            {children}
        </BaseMenu.Group>
    )
}

export function MenuSeparator() {
    return <BaseMenu.Separator className={styles.separator} />
}

export interface SubmenuProps {
    label: ReactNode
    icon?: ReactNode
    children: ReactNode
    disabled?: boolean
}

/** A nested menu opened from an item with a trailing chevron. */
export function Submenu({ label, icon, children, disabled }: SubmenuProps) {
    return (
        <BaseMenu.SubmenuRoot>
            <BaseMenu.SubmenuTrigger className={styles.item} disabled={disabled}>
                <Slots icon={icon} trailing={<Glyph name="chevron_right" size={20} className={styles.trailingIcon} />}>
                    {label}
                </Slots>
            </BaseMenu.SubmenuTrigger>
            <MenuContent side="inline-end" align="start" sideOffset={-4}>
                {children}
            </MenuContent>
        </BaseMenu.SubmenuRoot>
    )
}
