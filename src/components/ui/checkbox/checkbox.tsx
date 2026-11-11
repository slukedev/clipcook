'use client'

import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import type { ComponentProps, ReactNode } from 'react'
import { cx } from '../cx'
import styles from './checkbox.module.scss'

export interface CheckboxProps extends Omit<ComponentProps<typeof BaseCheckbox.Root>, 'className'> {
    /** Visible label; omit and pass `aria-label` when the row provides the text. */
    label?: ReactNode
    /** Error state. */
    invalid?: boolean
    className?: string
}

/** M3 checkbox. The check draws along its path; indeterminate shows a dash. */
export function Checkbox({ label, invalid, className, ...rest }: CheckboxProps) {
    const control = (
        <BaseCheckbox.Root className={cx(styles.root, !label && className)} data-invalid={invalid || undefined} {...rest}>
            <span className={styles.box}>
                <svg viewBox="0 0 18 18" className={styles.mark} aria-hidden focusable="false">
                    <path className={styles.check} d="M4.5 9.5l3 3 6-7" pathLength={14} />
                    <path className={styles.dash} d="M5 9h8" />
                </svg>
            </span>
        </BaseCheckbox.Root>
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
