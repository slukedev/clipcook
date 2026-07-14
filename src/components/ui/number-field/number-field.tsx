'use client'

import { NumberField as BaseNumberField } from '@base-ui/react/number-field'
import { cx } from '../cx'
import { Icon } from '../icon'
import { Ripple } from '../ripple'
import styles from './number-field.module.scss'

interface NumberFieldProps {
    label: string
    value?: number | null
    defaultValue?: number
    onValueChange?: (value: number | null) => void
    min?: number
    max?: number
    step?: number
    disabled?: boolean
    className?: string
}

/** M3 pill stepper for numeric values (e.g. servings). */
export function NumberField({ label, className, ...props }: NumberFieldProps) {
    return (
        <BaseNumberField.Root aria-label={label} className={cx(styles.root, className)} {...props}>
            <BaseNumberField.Group className={styles.group}>
                <BaseNumberField.Decrement className={styles.step}>
                    <Icon name="remove" size={20} />
                    <Ripple />
                </BaseNumberField.Decrement>
                <BaseNumberField.Input className={styles.value} />
                <BaseNumberField.Increment className={styles.step}>
                    <Icon name="add" size={20} />
                    <Ripple />
                </BaseNumberField.Increment>
            </BaseNumberField.Group>
        </BaseNumberField.Root>
    )
}
