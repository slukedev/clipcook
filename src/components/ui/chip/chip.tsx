'use client'

import { Button as BaseButton } from '@base-ui/react/button'
import { Toggle } from '@base-ui/react/toggle'
import type { ComponentProps, HTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx'
import { Glyph } from '../icon/glyph'
import { Ripple } from '../ripple/ripple'
import styles from './chip.module.scss'

interface ChipBase {
    children: ReactNode
    /** Leading icon element. */
    icon?: ReactNode
    elevated?: boolean
    className?: string
}

export type AssistChipProps = ChipBase & Omit<ComponentProps<typeof BaseButton>, 'className' | 'children'>

/** Assist chip: a smart action related to the content ("Add to list"). */
export function AssistChip({ children, icon, elevated, className, ...rest }: AssistChipProps) {
    return (
        <BaseButton
            className={cx(styles.chip, styles.assist, className)}
            data-elevated={elevated || undefined}
            data-has-leading={icon ? '' : undefined}
            {...rest}
        >
            <span data-touch-target aria-hidden />
            <Ripple />
            {icon && <span className={styles.icon}>{icon}</span>}
            {children}
        </BaseButton>
    )
}

/** Suggestion chip: a dynamically generated choice ("Under 30 min"). */
export function SuggestionChip({ children, icon, elevated, className, ...rest }: AssistChipProps) {
    return (
        <BaseButton
            className={cx(styles.chip, className)}
            data-elevated={elevated || undefined}
            data-has-leading={icon ? '' : undefined}
            {...rest}
        >
            <span data-touch-target aria-hidden />
            <Ripple />
            {icon && <span className={styles.icon}>{icon}</span>}
            {children}
        </BaseButton>
    )
}

export type FilterChipProps = ChipBase &
    Omit<ComponentProps<typeof Toggle>, 'className' | 'children' | 'pressed' | 'defaultPressed' | 'onPressedChange'> & {
        selected?: boolean
        defaultSelected?: boolean
        onSelectedChange?: (selected: boolean) => void
        /** Trailing element, such as a dropdown arrow for a chip that opens a menu. */
        trailing?: ReactNode
    }

/** Filter chip: toggles a filter. A check grows in (or replaces the icon) when selected. */
export function FilterChip({
    children,
    icon,
    elevated,
    selected,
    defaultSelected,
    onSelectedChange,
    trailing,
    className,
    ...rest
}: FilterChipProps) {
    return (
        <Toggle
            className={cx(styles.chip, styles.filter, className)}
            data-elevated={elevated || undefined}
            data-has-leading={icon ? '' : undefined}
            data-has-trailing={trailing ? '' : undefined}
            pressed={selected}
            defaultPressed={defaultSelected}
            onPressedChange={onSelectedChange ? (value) => onSelectedChange(value) : undefined}
            {...rest}
        >
            <span data-touch-target aria-hidden />
            <Ripple />
            {icon ? (
                <span className={styles.icon}>
                    <span className={cx(styles.swap, styles.swapIcon)}>{icon}</span>
                    <Glyph name="check" className={cx(styles.swap, styles.swapCheck)} />
                </span>
            ) : (
                <span className={styles.check} aria-hidden>
                    <Glyph name="check" />
                </span>
            )}
            {children}
            {trailing && <span className={styles.icon}>{trailing}</span>}
        </Toggle>
    )
}

export interface InputChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'>, ChipBase {
    /** Leading avatar (24dp). */
    avatar?: ReactNode
    selected?: boolean
    /** Shows the remove button. */
    onRemove?: () => void
    /** Accessible name for the remove button. */
    removeLabel?: string
    disabled?: boolean
}

/** Input chip: a piece of user input, such as a tag, with an optional remove button. */
export function InputChip({
    children,
    icon,
    avatar,
    elevated,
    selected,
    onRemove,
    removeLabel,
    disabled,
    className,
    ...rest
}: InputChipProps) {
    return (
        <span
            className={cx(styles.chip, styles.input, className)}
            data-elevated={elevated || undefined}
            data-selected={selected || undefined}
            data-disabled={disabled || undefined}
            data-has-leading={icon || avatar ? '' : undefined}
            data-has-trailing={onRemove ? '' : undefined}
            {...rest}
        >
            {avatar ? (
                <span className={styles.avatar}>{avatar}</span>
            ) : (
                icon && <span className={styles.icon}>{icon}</span>
            )}
            {children}
            {onRemove && (
                <button
                    type="button"
                    className={styles.remove}
                    onClick={onRemove}
                    disabled={disabled}
                    aria-label={removeLabel ?? (typeof children === 'string' ? `Remove ${children}` : 'Remove')}
                >
                    <Glyph name="close" size={18} />
                </button>
            )}
        </span>
    )
}

export interface ChipSetProps extends HTMLAttributes<HTMLDivElement> {
    /** One scrolling row with fading edges instead of wrapping. */
    scroll?: boolean
    /** Accessible name for the group. */
    label?: string
}

export function ChipSet({ scroll = false, label, className, children, ...rest }: ChipSetProps) {
    return (
        // biome-ignore lint/a11y/useSemanticElements: chips are actions and filters, not a form fieldset
        <div
            role="group"
            aria-label={label}
            className={cx(styles.set, className)}
            data-scroll={scroll || undefined}
            {...rest}
        >
            {children}
        </div>
    )
}
