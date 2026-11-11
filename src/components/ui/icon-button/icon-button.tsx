'use client'

import { Button as BaseButton } from '@base-ui/react/button'
import { Toggle } from '@base-ui/react/toggle'
import type { ComponentProps, ReactNode } from 'react'
import type { ButtonShape, ButtonSize } from '../button/button'
import { cx } from '../cx'
import { Ripple } from '../ripple/ripple'
import styles from './icon-button.module.scss'

export type IconButtonVariant = 'standard' | 'filled' | 'tonal' | 'outlined'
export type IconButtonWidth = 'narrow' | 'default' | 'wide'

interface CommonProps {
    className?: string
    /** Accessible name; icon buttons have no visible label. */
    label: string
    icon: ReactNode
    /** Shown while a toggle is selected, usually the filled glyph. */
    selectedIcon?: ReactNode
    variant?: IconButtonVariant
    size?: ButtonSize
    width?: IconButtonWidth
    shape?: ButtonShape
}

type PlainProps = CommonProps &
    Omit<ComponentProps<typeof BaseButton>, 'children' | 'className'> & {
        selected?: undefined
        defaultSelected?: undefined
        onSelectedChange?: undefined
    }

type ToggleProps = CommonProps &
    Omit<ComponentProps<typeof Toggle>, 'children' | 'className' | 'pressed' | 'defaultPressed' | 'onPressedChange'> & {
        selected?: boolean
        defaultSelected?: boolean
        onSelectedChange?: (selected: boolean) => void
    }

export type IconButtonProps = PlainProps | ToggleProps

/** M3 Expressive icon button: XS to XL, narrow/default/wide, optional toggle. */
export function IconButton(props: IconButtonProps) {
    const {
        label,
        icon,
        selectedIcon,
        variant = 'standard',
        size = 's',
        width = 'default',
        shape = 'round',
        className,
        ...rest
    } = props
    const shared = {
        className: cx(styles.button, styles[variant], className),
        'aria-label': label,
        'data-size': size,
        'data-width': width,
        'data-shape': shape,
    }
    if (props.selected !== undefined || props.defaultSelected !== undefined || props.onSelectedChange) {
        const { selected, defaultSelected, onSelectedChange, ...toggleRest } = rest as Omit<
            ToggleProps,
            keyof CommonProps
        >
        return (
            <Toggle
                {...toggleRest}
                {...shared}
                data-toggle=""
                pressed={selected}
                defaultPressed={defaultSelected}
                onPressedChange={onSelectedChange ? (value) => onSelectedChange(value) : undefined}
                render={(renderProps, state) => (
                    <button type="button" {...renderProps}>
                        <span data-touch-target aria-hidden />
                        <Ripple />
                        <span className={styles.icon}>{state.pressed && selectedIcon ? selectedIcon : icon}</span>
                    </button>
                )}
            />
        )
    }
    return (
        <BaseButton {...(rest as Omit<PlainProps, keyof CommonProps>)} {...shared}>
            <span data-touch-target aria-hidden />
            <Ripple />
            <span className={styles.icon}>{icon}</span>
        </BaseButton>
    )
}
