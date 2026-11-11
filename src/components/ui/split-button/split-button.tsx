'use client'

import { Button as BaseButton } from '@base-ui/react/button'
import { Menu as BaseMenu } from '@base-ui/react/menu'
import type { ComponentProps, ReactNode } from 'react'
import type { ButtonSize } from '../button/button'
import { cx } from '../cx'
import { Glyph } from '../icon/glyph'
import { MenuContent } from '../menu/menu'
import { Ripple } from '../ripple/ripple'
import styles from './split-button.module.scss'

export interface SplitButtonProps extends Omit<ComponentProps<typeof BaseButton>, 'className' | 'children'> {
    /** The primary action's label. */
    children: ReactNode
    icon?: ReactNode
    variant?: 'filled' | 'tonal' | 'outlined' | 'elevated'
    size?: ButtonSize
    /** Accessible name for the menu half. */
    menuLabel: string
    /** Menu items (`MenuItem` and friends) for the related actions. */
    menu: ReactNode
    className?: string
}

/** Split button: a main action plus a menu of related ones. */
export function SplitButton({
    children,
    icon,
    variant = 'filled',
    size = 's',
    menuLabel,
    menu,
    className,
    disabled,
    ...rest
}: SplitButtonProps) {
    return (
        <div className={cx(styles.split, className)} data-size={size}>
            <BaseButton className={cx(styles.part, styles.leading, styles[variant])} data-size={size} disabled={disabled} {...rest}>
                <span data-touch-target aria-hidden />
                <Ripple />
                {icon && <span className={styles.icon}>{icon}</span>}
                {children}
            </BaseButton>
            <BaseMenu.Root>
                <BaseMenu.Trigger
                    className={cx(styles.part, styles.trailing, styles[variant])}
                    data-size={size}
                    aria-label={menuLabel}
                    disabled={disabled}
                >
                    <span data-touch-target aria-hidden />
                    <Ripple />
                    <Glyph name="keyboard_arrow_down" className={styles.chevron} />
                </BaseMenu.Trigger>
                <MenuContent align="end">{menu}</MenuContent>
            </BaseMenu.Root>
        </div>
    )
}
