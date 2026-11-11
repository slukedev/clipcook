'use client'

import { type ReactNode, useSyncExternalStore } from 'react'
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import styles from './adaptive-sheet.module.scss'

const COMPACT = '(width < 600px)'

function subscribe(onChange: () => void) {
    const query = window.matchMedia(COMPACT)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
}

export function useCompactWindow(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(COMPACT).matches,
        () => false,
    )
}

/** A bottom sheet on compact windows (thumb reach, drag to dismiss), a dialog elsewhere. */
export function AdaptiveSheet({
    open,
    onOpenChange,
    title,
    actions,
    children,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    actions: ReactNode
    children: ReactNode
}) {
    const compact = useCompactWindow()
    if (compact) {
        return (
            <BottomSheet open={open} onOpenChange={onOpenChange}>
                <BottomSheetContent title={title}>
                    <div className={styles.sheetBody}>{children}</div>
                    <div className={styles.sheetActions}>{actions}</div>
                </BottomSheetContent>
            </BottomSheet>
        )
    }
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent headline={title} actions={actions} className={styles.dialog}>
                {children}
            </DialogContent>
        </Dialog>
    )
}
