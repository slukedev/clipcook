'use client'

import { Select as BaseSelect } from '@base-ui/react/select'
import type { ReactNode } from 'react'
import { cx } from '../cx'
import { Glyph } from '../icon/glyph'
import styles from './select.module.scss'

export interface SelectOption<V extends string = string> {
    value: V
    label: string
    icon?: ReactNode
    disabled?: boolean
}

export interface SelectProps<V extends string = string> {
    label: string
    options: SelectOption<V>[]
    value?: V | null
    defaultValue?: V | null
    onValueChange?: (value: V | null) => void
    placeholder?: string
    variant?: 'filled' | 'outlined'
    name?: string
    disabled?: boolean
    required?: boolean
    className?: string
}

/** M3 exposed dropdown: a field-shaped trigger with a menu of options. */
export function Select<V extends string = string>({
    label,
    options,
    value,
    defaultValue,
    onValueChange,
    placeholder = 'Choose',
    variant = 'filled',
    name,
    disabled,
    required,
    className,
}: SelectProps<V>) {
    const items = Object.fromEntries(options.map((o) => [o.value, o.label]))
    return (
        <BaseSelect.Root
            items={items}
            value={value}
            defaultValue={defaultValue}
            onValueChange={onValueChange ? (next) => onValueChange(next as V | null) : undefined}
            name={name}
            disabled={disabled}
            required={required}
        >
            <div className={cx(styles.root, className)}>
                <BaseSelect.Trigger className={styles.trigger} data-variant={variant} aria-label={label}>
                    <span className={styles.text}>
                        <span className={styles.label}>{label}</span>
                        <BaseSelect.Value className={styles.value} placeholder={placeholder} />
                    </span>
                    <BaseSelect.Icon className={styles.arrow}>
                        <Glyph name="arrow_drop_down" />
                    </BaseSelect.Icon>
                </BaseSelect.Trigger>
            </div>
            <BaseSelect.Portal>
                <BaseSelect.Positioner className={styles.positioner} sideOffset={4} alignItemWithTrigger={false}>
                    <BaseSelect.Popup className={styles.popup}>
                        <BaseSelect.List className={styles.list}>
                            {options.map((option) => (
                                <BaseSelect.Item
                                    key={option.value}
                                    value={option.value}
                                    disabled={option.disabled}
                                    className={styles.item}
                                >
                                    {option.icon}
                                    <BaseSelect.ItemText className={styles.itemText}>{option.label}</BaseSelect.ItemText>
                                    <BaseSelect.ItemIndicator className={styles.indicator}>
                                        <Glyph name="check" size={20} />
                                    </BaseSelect.ItemIndicator>
                                </BaseSelect.Item>
                            ))}
                        </BaseSelect.List>
                    </BaseSelect.Popup>
                </BaseSelect.Positioner>
            </BaseSelect.Portal>
        </BaseSelect.Root>
    )
}
