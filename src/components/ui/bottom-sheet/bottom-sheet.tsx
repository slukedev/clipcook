'use client'

import { Drawer } from '@base-ui/react/drawer'
import { cx } from '../cx'
import styles from './bottom-sheet.module.scss'

/** Root — controls open state. Swipe down to dismiss. */
export function BottomSheet(props: React.ComponentProps<typeof Drawer.Root>) {
    return <Drawer.Root swipeDirection="down" {...props} />
}

export function BottomSheetTrigger(props: React.ComponentProps<typeof Drawer.Trigger>) {
    return <Drawer.Trigger {...props} />
}

interface BottomSheetContentProps {
    children: React.ReactNode
    className?: string
}

/** M3 modal bottom sheet: drag handle, scrim, swipe-to-dismiss. */
export function BottomSheetContent({ children, className }: BottomSheetContentProps) {
    return (
        <Drawer.Portal>
            <Drawer.Backdrop className={styles.scrim} />
            <Drawer.Viewport className={styles.viewport}>
                <Drawer.Popup className={cx(styles.popup, className)}>
                    <div className={styles.handle} aria-hidden="true" />
                    <Drawer.Content className={styles.content}>{children}</Drawer.Content>
                </Drawer.Popup>
            </Drawer.Viewport>
        </Drawer.Portal>
    )
}

export function BottomSheetTitle({ children }: { children: React.ReactNode }) {
    return <Drawer.Title className={styles.title}>{children}</Drawer.Title>
}

export function BottomSheetClose(props: React.ComponentProps<typeof Drawer.Close>) {
    return <Drawer.Close {...props} />
}
