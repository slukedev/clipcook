'use client'

import { Button as BaseButton } from '@base-ui/react/button'
import { Toggle } from '@base-ui/react/toggle'
import type { ComponentProps, ReactNode } from 'react'
import { cx } from '../cx'
import { LoadingIndicator } from '../loading-indicator/loading-indicator'
import { Ripple } from '../ripple/ripple'
import styles from './button.module.scss'

export type ButtonSize = 'xs' | 's' | 'm' | 'l' | 'xl'
export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'elevated' | 'text'
export type ButtonShape = 'round' | 'square'

const ICON_PX: Record<ButtonSize, number> = { xs: 20, s: 20, m: 24, l: 32, xl: 40 }

interface CommonProps {
    className?: string
    variant?: ButtonVariant
    size?: ButtonSize
    /** Resting shape. Press squares the corners off; toggles swap shape when selected. */
    shape?: ButtonShape
    /** Leading icon element, e.g. `<Icon name="add" />`. */
    icon?: ReactNode
    /** Icon shown instead of `icon` while a toggle is selected (usually the filled glyph). */
    selectedIcon?: ReactNode
    trailingIcon?: ReactNode
    /** Busy: shows a loading indicator, sets aria-busy and ignores presses. */
    loading?: boolean
    children?: ReactNode
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

export type ButtonProps = PlainProps | ToggleProps

function isToggle(props: ButtonProps): props is ToggleProps {
    return props.selected !== undefined || props.defaultSelected !== undefined || props.onSelectedChange !== undefined
}

/**
 * M3 Expressive button: five sizes, five variants, round or square, optional
 * toggle (pass `selected` / `defaultSelected` / `onSelectedChange`).
 * Render a link with `render={<Link href="..." />} nativeButton={false}`.
 */
export function Button(props: ButtonProps) {
    const {
        variant = 'filled',
        size = 's',
        shape = 'round',
        icon,
        selectedIcon,
        trailingIcon,
        loading = false,
        children,
        className,
        ...rest
    } = props
    const toggle = isToggle(props)
    const spinner = <LoadingIndicator className={styles.spinner} size={ICON_PX[size] + 4} label="Loading" />
    const leading = loading && icon ? spinner : icon
    const content = (
        <>
            <span data-touch-target aria-hidden />
            <Ripple disabled={loading} />
            {leading && <span className={styles.icon}>{leading}</span>}
            {children !== undefined && <span className={styles.label}>{children}</span>}
            {loading && !icon && spinner}
            {trailingIcon && <span className={styles.icon}>{trailingIcon}</span>}
        </>
    )
    const shared = {
        className: cx(styles.button, styles[variant], className),
        'data-size': size,
        'data-shape': shape,
        'data-has-icon': icon ? '' : undefined,
        'data-loading': loading ? '' : undefined,
        'aria-busy': loading || undefined,
    }

    if (toggle) {
        const { selected, defaultSelected, onSelectedChange, ...toggleRest } = rest as Omit<ToggleProps, keyof CommonProps>
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
                        <Ripple disabled={loading} />
                        {(icon || selectedIcon) && (
                            <span className={styles.icon}>{state.pressed && selectedIcon ? selectedIcon : leading}</span>
                        )}
                        {children !== undefined && <span className={styles.label}>{children}</span>}
                        {loading && !icon && spinner}
                        {trailingIcon && <span className={styles.icon}>{trailingIcon}</span>}
                    </button>
                )}
            />
        )
    }

    const { onClick, ...buttonRest } = rest as Omit<PlainProps, keyof CommonProps>
    return (
        <BaseButton
            {...buttonRest}
            {...shared}
            onClick={loading ? (event) => event.preventDefault() : onClick}
            focusableWhenDisabled={loading || buttonRest.focusableWhenDisabled}
        >
            {content}
        </BaseButton>
    )
}
