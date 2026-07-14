'use client'

import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import styles from './tooltip.module.scss'

interface TooltipProps {
    label: string
    children: React.ReactElement
}

/** M3 plain tooltip on hover/focus. Wraps its trigger element. */
export function Tooltip({ label, children }: TooltipProps) {
    return (
        <BaseTooltip.Root>
            <BaseTooltip.Trigger render={children} />
            <BaseTooltip.Portal>
                <BaseTooltip.Positioner side="bottom" sideOffset={6} className={styles.positioner}>
                    <BaseTooltip.Popup className={styles.popup}>{label}</BaseTooltip.Popup>
                </BaseTooltip.Positioner>
            </BaseTooltip.Portal>
        </BaseTooltip.Root>
    )
}
