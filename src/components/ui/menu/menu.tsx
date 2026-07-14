'use client'

import { Menu as BaseMenu } from '@base-ui/react/menu'
import { Separator } from '@base-ui/react/separator'
import { cx } from '../cx'
import { Icon, type IconName } from '../icon'
import styles from './menu.module.scss'

export const Menu = BaseMenu.Root

export function MenuTrigger(props: React.ComponentProps<typeof BaseMenu.Trigger>) {
    return <BaseMenu.Trigger {...props} />
}

interface MenuContentProps {
    children: React.ReactNode
    align?: React.ComponentProps<typeof BaseMenu.Positioner>['align']
    side?: React.ComponentProps<typeof BaseMenu.Positioner>['side']
    className?: string
}

export function MenuContent({ children, align = 'end', side = 'bottom', className }: MenuContentProps) {
    return (
        <BaseMenu.Portal>
            <BaseMenu.Positioner align={align} side={side} sideOffset={4} className={styles.positioner}>
                <BaseMenu.Popup className={cx(styles.popup, className)}>{children}</BaseMenu.Popup>
            </BaseMenu.Positioner>
        </BaseMenu.Portal>
    )
}

interface MenuItemProps extends Omit<React.ComponentProps<typeof BaseMenu.Item>, 'className'> {
    icon?: IconName
    /** Error-colored item for destructive actions. */
    destructive?: boolean
    className?: string
}

export function MenuItem({ icon, destructive, className, children, ...props }: MenuItemProps) {
    return (
        <BaseMenu.Item className={cx(styles.item, destructive && styles.destructive, className)} {...props}>
            {icon && <Icon name={icon} className={styles.itemIcon} />}
            <span className={styles.itemLabel}>{children}</span>
        </BaseMenu.Item>
    )
}

export function MenuSeparator() {
    return <Separator className={styles.separator} />
}
