'use client'

import { Radio as BaseRadio } from '@base-ui/react/radio'
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group'
import type { ComponentProps, ReactNode } from 'react'
import { cx } from '../cx'
import styles from './radio.module.scss'

export interface RadioGroupProps extends Omit<ComponentProps<typeof BaseRadioGroup>, 'className'> {
    /** Accessible name for the group. */
    label?: string
    className?: string
}

export function RadioGroup({ label, className, ...rest }: RadioGroupProps) {
    return <BaseRadioGroup aria-label={label} className={cx(styles.group, className)} {...rest} />
}

export interface RadioProps extends Omit<ComponentProps<typeof BaseRadio.Root>, 'className'> {
    label?: ReactNode
    className?: string
}

/** M3 radio button; the dot springs in when selected. Use inside `RadioGroup`. */
export function Radio({ label, className, ...rest }: RadioProps) {
    const control = (
        <BaseRadio.Root className={cx(styles.root, !label && className)} {...rest}>
            <span className={styles.ring}>
                <BaseRadio.Indicator keepMounted className={styles.dot} />
            </span>
        </BaseRadio.Root>
    )
    if (!label) return control
    return (
        // biome-ignore lint/a11y/noLabelWithoutControl: the Base UI root inside is the control
        <label className={cx(styles.field, className)}>
            {control}
            {label}
        </label>
    )
}
