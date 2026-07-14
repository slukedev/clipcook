'use client'

import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { useId } from 'react'
import { cx } from '../cx'
import { Ripple } from '../ripple'
import styles from './checkbox.module.scss'

interface CheckboxProps extends Omit<React.ComponentProps<typeof BaseCheckbox.Root>, 'className'> {
    /** Renders a clickable label row next to the box. */
    label?: React.ReactNode
    className?: string
}

/**
 * M3 checkbox: 18dp box inside a 40dp state-layer target,
 * animated check draw-in.
 */
export function Checkbox({ label, className, id: idProp, ...props }: CheckboxProps) {
    const generatedId = useId()
    const id = idProp ?? (label ? generatedId : undefined)

    const box = (
        <span className={cx(styles.target, className)}>
            <BaseCheckbox.Root id={id} className={styles.box} {...props}>
                <BaseCheckbox.Indicator className={styles.indicator} keepMounted>
                    <svg viewBox="0 0 18 18" aria-hidden="true" className={styles.check}>
                        <path d="M4 9.5 7.5 13 14 5.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
                    </svg>
                </BaseCheckbox.Indicator>
            </BaseCheckbox.Root>
            <Ripple />
        </span>
    )

    if (!label) return box

    return (
        <span className={styles.row}>
            {box}
            <label htmlFor={id} className={styles.label}>
                {label}
            </label>
        </span>
    )
}
