'use client'

import { Switch as BaseSwitch } from '@base-ui/react/switch'
import type { ComponentProps, ReactNode } from 'react'
import fieldStyles from '../checkbox/checkbox.module.scss'
import { cx } from '../cx'
import { Glyph } from '../icon/glyph'
import styles from './switch.module.scss'

export interface SwitchProps extends Omit<ComponentProps<typeof BaseSwitch.Root>, 'className'> {
    label?: ReactNode
    /** Check and close glyphs inside the thumb. */
    icons?: boolean
    className?: string
}

/** M3 switch: the thumb grows on press and springs across. */
export function Switch({ label, icons = false, className, ...rest }: SwitchProps) {
    const control = (
        <BaseSwitch.Root className={cx(styles.root, !label && className)} data-icons={icons || undefined} {...rest}>
            <BaseSwitch.Thumb className={styles.thumb}>
                {icons && (
                    <>
                        <Glyph name="check" className={styles.on} />
                        <Glyph name="close" className={styles.off} />
                    </>
                )}
            </BaseSwitch.Thumb>
        </BaseSwitch.Root>
    )
    if (!label) return control
    return (
        // biome-ignore lint/a11y/noLabelWithoutControl: the Base UI root inside is the control
        <label className={cx(fieldStyles.field, className)} data-switch-field="">
            {label}
            {control}
        </label>
    )
}
