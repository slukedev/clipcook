'use client'

import { Slider as BaseSlider } from '@base-ui/react/slider'
import { type ReactNode, useState } from 'react'
import { cx } from '../cx'
import styles from './slider.module.scss'

export type SliderSize = 'xs' | 's' | 'm' | 'l' | 'xl'

export interface SliderProps {
    value?: number
    defaultValue?: number
    onValueChange?: (value: number) => void
    /** Fires once the user lets go. */
    onValueCommitted?: (value: number) => void
    min?: number
    max?: number
    step?: number
    size?: SliderSize
    /** Icon inside the start of the track (medium and larger). */
    icon?: ReactNode
    /** Formats the value bubble and the accessible value text. */
    format?: (value: number) => string
    /** Accessible name. */
    label: string
    disabled?: boolean
    name?: string
    className?: string
}

/** M3 Expressive slider with a gap around the handle and a value bubble while dragging. */
export function Slider({
    value,
    defaultValue,
    onValueChange,
    onValueCommitted,
    min = 0,
    max = 100,
    step = 1,
    size = 'xs',
    icon,
    format = String,
    label,
    disabled,
    name,
    className,
}: SliderProps) {
    const [internal, setInternal] = useState(defaultValue ?? min)
    const current = value ?? internal
    return (
        <BaseSlider.Root
            className={cx(styles.root, className)}
            data-size={size}
            value={current}
            onValueChange={(next) => {
                const v = Array.isArray(next) ? (next[0] ?? min) : next
                setInternal(v)
                onValueChange?.(v)
            }}
            onValueCommitted={(next) => onValueCommitted?.(Array.isArray(next) ? (next[0] ?? min) : next)}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            name={name}
        >
            <BaseSlider.Control className={styles.control}>
                <BaseSlider.Track className={styles.track}>
                    {icon && size !== 'xs' && size !== 's' && <span className={styles.insetIcon}>{icon}</span>}
                    <BaseSlider.Indicator className={styles.indicator} />
                    <BaseSlider.Thumb
                        className={styles.thumb}
                        aria-label={label}
                        getAriaValueText={(_text, v) => format(v)}
                    >
                        <span className={styles.value} aria-hidden>
                            {format(current)}
                        </span>
                    </BaseSlider.Thumb>
                </BaseSlider.Track>
            </BaseSlider.Control>
        </BaseSlider.Root>
    )
}
