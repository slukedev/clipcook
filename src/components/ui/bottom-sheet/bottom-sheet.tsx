'use client'

import { Drawer } from '@base-ui/react/drawer'
import type { ComponentProps, ReactNode } from 'react'
import { cx } from '../cx'
import styles from './bottom-sheet.module.scss'

export interface BottomSheetProps extends Omit<ComponentProps<typeof Drawer.Root>, 'swipeDirection'> {}

/**
 * M3 bottom sheet on Base UI Drawer: drag the handle (or content) to dismiss,
 * velocity-aware, with optional `snapPoints`. `modal={false}` for a standard sheet.
 */
export function BottomSheet(props: BottomSheetProps) {
    return <Drawer.Root swipeDirection="down" {...props} />
}

export const BottomSheetTrigger = Drawer.Trigger
export const BottomSheetClose = Drawer.Close

export interface BottomSheetContentProps {
    /** Required for assistive tech; hide it visually with `hideTitle`. */
    title: ReactNode
    hideTitle?: boolean
    children: ReactNode
    /** Standard (non-modal) sheets have no scrim. */
    standard?: boolean
    className?: string
}

export function BottomSheetContent({ title, hideTitle = false, children, standard = false, className }: BottomSheetContentProps) {
    return (
        <Drawer.Portal>
            {!standard && <Drawer.Backdrop className={styles.backdrop} />}
            <Drawer.Viewport className={styles.viewport}>
                <Drawer.Popup className={cx(styles.popup, className)} data-standard={standard || undefined}>
                    <div className={styles.handle} aria-hidden />
                    <Drawer.Title className={hideTitle ? styles.hiddenTitle : styles.title}>{title}</Drawer.Title>
                    <Drawer.Content className={styles.body}>{children}</Drawer.Content>
                </Drawer.Popup>
            </Drawer.Viewport>
        </Drawer.Portal>
    )
}
