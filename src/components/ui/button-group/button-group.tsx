'use client'

import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { Children, type ComponentProps, type HTMLAttributes, type ReactNode, useEffect, useRef } from 'react'
import type { ButtonSize } from '../button/button'
import { cx } from '../cx'
import { Glyph } from '../icon/glyph'
import { Ripple } from '../ripple/ripple'
import styles from './button-group.module.scss'

// ButtonGroup.kt: a pressed button grows by 15% of its width, taken from its neighbors.
const EXPAND_RATIO = 0.15

export interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
    /** Matches the buttons inside; sets the gap. */
    size?: ButtonSize
    /** Accessible name for the group. */
    label?: string
    children: ReactNode
}

/** Standard button group: separate buttons whose neighbors give way on press. */
export function ButtonGroup({ size = 's', label, className, children, ...rest }: ButtonGroupProps) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const group = ref.current
        if (!group || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        let natural: number[] = []
        let clearTimer = 0
        const slots = () => Array.from(group.children) as HTMLElement[]

        const release = () => {
            if (natural.length === 0) return
            const all = slots()
            all.forEach((slot, k) => {
                slot.style.flexBasis = `${natural[k]}px`
            })
            natural = []
            clearTimer = window.setTimeout(() => {
                for (const slot of all) slot.style.flexBasis = ''
            }, 400)
        }

        const press = (event: PointerEvent) => {
            const all = slots()
            const index = all.findIndex((slot) => slot.contains(event.target as Node))
            const pressed = all[index]
            if (!pressed || pressed.querySelector(':disabled, [data-disabled]')) return
            window.clearTimeout(clearTimer)
            natural = all.map((slot) => slot.getBoundingClientRect().width)
            const grow = (natural[index] ?? 0) * EXPAND_RATIO
            const before = all[index - 1]
            const after = all[index + 1]
            const widths = [...natural]
            widths[index] = (widths[index] ?? 0) + grow
            if (before && after) {
                widths[index - 1] = (widths[index - 1] ?? 0) - grow / 2
                widths[index + 1] = (widths[index + 1] ?? 0) - grow / 2
            } else if (before) {
                widths[index - 1] = (widths[index - 1] ?? 0) - grow
            } else if (after) {
                widths[index + 1] = (widths[index + 1] ?? 0) - grow
            }
            all.forEach((slot, k) => {
                slot.style.flexBasis = `${natural[k]}px`
            })
            // Next frame, so the transition starts from the measured widths.
            requestAnimationFrame(() => {
                all.forEach((slot, k) => {
                    slot.style.flexBasis = `${Math.max(0, widths[k] ?? 0)}px`
                })
            })
            window.addEventListener('pointerup', release, { once: true })
            window.addEventListener('pointercancel', release, { once: true })
        }

        group.addEventListener('pointerdown', press)
        return () => {
            group.removeEventListener('pointerdown', press)
            window.removeEventListener('pointerup', release)
            window.removeEventListener('pointercancel', release)
            window.clearTimeout(clearTimer)
        }
    }, [])

    return (
        <div ref={ref} role="group" aria-label={label} data-size={size} className={cx(styles.group, className)} {...rest}>
            {Children.map(children, (child) => (child ? <div className={styles.slot}>{child}</div> : null))}
        </div>
    )
}

export interface ConnectedButtonGroupProps
    extends Omit<ComponentProps<typeof ToggleGroup>, 'className' | 'value' | 'defaultValue' | 'onValueChange'> {
    value?: string[]
    defaultValue?: string[]
    onValueChange?: (value: string[]) => void
    size?: ButtonSize
    variant?: 'tonal' | 'filled' | 'outlined'
    /** Stretch to the container with equal-width items. */
    fill?: boolean
    label?: string
    className?: string
}

/**
 * Connected button group (replaces segmented buttons): single or multi select
 * (`multiple`). Items are `ConnectedButtonGroupItem`.
 */
export function ConnectedButtonGroup({
    size = 's',
    variant = 'tonal',
    fill = false,
    label,
    className,
    onValueChange,
    ...rest
}: ConnectedButtonGroupProps) {
    return (
        <ToggleGroup
            aria-label={label}
            className={cx(styles.connected, className)}
            data-size={size}
            data-variant={variant}
            data-fill={fill || undefined}
            onValueChange={onValueChange ? (value) => onValueChange(value) : undefined}
            {...rest}
        />
    )
}

export interface ConnectedButtonGroupItemProps
    extends Omit<ComponentProps<typeof Toggle>, 'className' | 'children' | 'value'> {
    value: string
    icon?: ReactNode
    /** Draws a check that grows in when selected. */
    check?: boolean
    size?: ButtonSize
    children?: ReactNode
    className?: string
}

export function ConnectedButtonGroupItem({
    value,
    icon,
    check = false,
    size = 's',
    children,
    className,
    ...rest
}: ConnectedButtonGroupItemProps) {
    return (
        <Toggle value={value} className={cx(styles.item, className)} data-size={size} {...rest}>
            <span data-touch-target aria-hidden />
            <Ripple />
            {check && (
                <span className={styles.check} aria-hidden>
                    <Glyph name="check" />
                </span>
            )}
            {icon && <span className={styles.icon}>{icon}</span>}
            {children}
        </Toggle>
    )
}
