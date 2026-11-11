'use client'

import { NumberField } from '@base-ui/react/number-field'
import { type ComponentProps, type CSSProperties, useId } from 'react'
import { cx } from '../cx'
import { Glyph } from '../icon/glyph'
import { Ripple } from '../ripple/ripple'
import styles from './number-stepper.module.scss'

export interface NumberStepperProps extends Omit<ComponentProps<typeof NumberField.Root>, 'className'> {
    /** Visible label above, or use `aria-label` via `labelHidden`. */
    label: string
    labelHidden?: boolean
    size?: 's' | 'm' | 'l'
    /** Width of the value in characters. */
    valueWidth?: number
    className?: string
}

/** Minus / value / plus for servings, timers and quantities. Typing works too. */
export function NumberStepper({
    label,
    labelHidden = false,
    size = 'm',
    valueWidth = 4,
    className,
    ...rest
}: NumberStepperProps) {
    const id = useId()
    return (
        <NumberField.Root
            id={id}
            className={cx(styles.root, className)}
            data-size={size}
            style={{ '--_value-width': `${valueWidth}ch` } as CSSProperties}
            {...rest}
        >
            {!labelHidden && (
                <label htmlFor={id} className={styles.label}>
                    {label}
                </label>
            )}
            <NumberField.Group className={styles.group}>
                <NumberField.Decrement className={styles.button} aria-label={`Decrease ${label.toLowerCase()}`}>
                    <Ripple />
                    <Glyph name="remove" />
                </NumberField.Decrement>
                <NumberField.Input className={styles.input} aria-label={labelHidden ? label : undefined} />
                <NumberField.Increment className={styles.button} aria-label={`Increase ${label.toLowerCase()}`}>
                    <Ripple />
                    <Glyph name="add" />
                </NumberField.Increment>
            </NumberField.Group>
        </NumberField.Root>
    )
}
