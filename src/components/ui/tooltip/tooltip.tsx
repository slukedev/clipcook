'use client'

import { Popover } from '@base-ui/react/popover'
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import type { ReactElement, ReactNode } from 'react'
import { cx } from '../cx'
import styles from './tooltip.module.scss'

type Side = 'top' | 'bottom' | 'left' | 'right' | 'inline-start' | 'inline-end'

/** Shares the open delay so neighboring tooltips open instantly. Mounted in the root layout. */
export function TooltipProvider({ children }: { children: ReactNode }) {
    return (
        <BaseTooltip.Provider delay={500} closeDelay={0}>
            {children}
        </BaseTooltip.Provider>
    )
}

export interface TooltipProps {
    /** Short label, usually the same words as the control's accessible name. */
    content: ReactNode
    /** One focusable element that forwards props and ref (Button, IconButton). */
    children: ReactElement
    side?: Side
    className?: string
}

/** Plain tooltip. Never put the only label of a control here. */
export function Tooltip({ content, children, side = 'bottom', className }: TooltipProps) {
    return (
        <BaseTooltip.Root>
            <BaseTooltip.Trigger render={children} />
            <BaseTooltip.Portal>
                <BaseTooltip.Positioner className={styles.positioner} side={side} sideOffset={4}>
                    <BaseTooltip.Popup className={cx(styles.plain, className)}>{content}</BaseTooltip.Popup>
                </BaseTooltip.Positioner>
            </BaseTooltip.Portal>
        </BaseTooltip.Root>
    )
}

export interface RichTooltipProps {
    subhead?: ReactNode
    text: ReactNode
    /** Text buttons. Rich tooltips with actions are popovers, so they keep focus. */
    actions?: ReactNode
    children: ReactElement
    side?: Side
    className?: string
}

/** Rich tooltip: a subhead, a sentence and optional actions; opens on hover or press. */
export function RichTooltip({ subhead, text, actions, children, side = 'bottom', className }: RichTooltipProps) {
    return (
        <Popover.Root>
            <Popover.Trigger render={children} openOnHover delay={500} />
            <Popover.Portal>
                <Popover.Positioner className={styles.positioner} side={side} sideOffset={4}>
                    <Popover.Popup className={cx(styles.rich, className)}>
                        {subhead && <Popover.Title className={styles.subhead}>{subhead}</Popover.Title>}
                        <Popover.Description className={styles.text}>{text}</Popover.Description>
                        {actions && <div className={styles.actions}>{actions}</div>}
                    </Popover.Popup>
                </Popover.Positioner>
            </Popover.Portal>
        </Popover.Root>
    )
}
