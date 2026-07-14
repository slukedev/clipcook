'use client'

import { Switch as BaseSwitch } from '@base-ui/react/switch'
import { useId } from 'react'
import { cx } from '../cx'
import { Icon } from '../icon'
import styles from './switch.module.scss'

interface SwitchProps extends Omit<React.ComponentProps<typeof BaseSwitch.Root>, 'className'> {
    /** Renders a clickable label row before the switch. */
    label?: React.ReactNode
    className?: string
}

/**
 * M3 switch: 52×32 track, handle grows on selection and press,
 * check glyph appears when on.
 */
export function Switch({ label, className, id: idProp, ...props }: SwitchProps) {
    const generatedId = useId()
    const id = idProp ?? (label ? generatedId : undefined)

    const control = (
        <BaseSwitch.Root id={id} className={cx(styles.track, className)} {...props}>
            <BaseSwitch.Thumb className={styles.handle}>
                <Icon name="check" size={20} className={styles.check} />
            </BaseSwitch.Thumb>
        </BaseSwitch.Root>
    )

    if (!label) return control

    return (
        <span className={styles.row}>
            <label htmlFor={id} className={styles.label}>
                {label}
            </label>
            {control}
        </span>
    )
}
