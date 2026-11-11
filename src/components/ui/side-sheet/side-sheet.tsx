'use client'

import { Drawer } from '@base-ui/react/drawer'
import type { ComponentProps, ReactNode } from 'react'
import { cx } from '../cx'
import { IconButton } from '../icon-button/icon-button'
import { Glyph } from '../icon/glyph'
import styles from './side-sheet.module.scss'

export function SideSheet(props: Omit<ComponentProps<typeof Drawer.Root>, 'swipeDirection'>) {
    return <Drawer.Root swipeDirection="right" {...props} />
}

export const SideSheetTrigger = Drawer.Trigger
export const SideSheetClose = Drawer.Close

export interface SideSheetContentProps {
    title: ReactNode
    children: ReactNode
    /** Buttons pinned to the bottom ("Apply", "Cancel"). */
    actions?: ReactNode
    className?: string
}

/** Modal side sheet, detached from the edge. Swipe toward the edge to dismiss. */
export function SideSheetContent({ title, children, actions, className }: SideSheetContentProps) {
    return (
        <Drawer.Portal>
            <Drawer.Backdrop className={styles.backdrop} />
            <Drawer.Viewport className={styles.viewport}>
                <Drawer.Popup className={cx(styles.popup, className)}>
                    <div className={styles.header}>
                        <Drawer.Title className={styles.title}>{title}</Drawer.Title>
                        <Drawer.Close render={<IconButton label="Close" icon={<Glyph name="close" />} />} />
                    </div>
                    <Drawer.Content className={styles.body}>{children}</Drawer.Content>
                    {actions && <div className={styles.actions}>{actions}</div>}
                </Drawer.Popup>
            </Drawer.Viewport>
        </Drawer.Portal>
    )
}
