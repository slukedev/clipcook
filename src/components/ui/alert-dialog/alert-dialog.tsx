'use client'

import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog'
import { cx } from '../cx'
import dialogStyles from '../dialog/dialog.module.scss'

/**
 * M3 alert dialog — same surface as Dialog, but it cannot be dismissed by
 * clicking outside, for confirmations with consequences.
 */
export const AlertDialog = BaseAlertDialog.Root

export function AlertDialogTrigger(props: React.ComponentProps<typeof BaseAlertDialog.Trigger>) {
    return <BaseAlertDialog.Trigger {...props} />
}

export function AlertDialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <BaseAlertDialog.Portal>
            <BaseAlertDialog.Backdrop className={dialogStyles.scrim} />
            <BaseAlertDialog.Popup className={cx(dialogStyles.popup, className)}>{children}</BaseAlertDialog.Popup>
        </BaseAlertDialog.Portal>
    )
}

export function AlertDialogHeadline({ children }: { children: React.ReactNode }) {
    return <BaseAlertDialog.Title className={dialogStyles.headline}>{children}</BaseAlertDialog.Title>
}

export function AlertDialogBody({ children }: { children: React.ReactNode }) {
    return (
        <BaseAlertDialog.Description render={<div />} className={dialogStyles.body}>
            {children}
        </BaseAlertDialog.Description>
    )
}

export function AlertDialogActions({ children }: { children: React.ReactNode }) {
    return <div className={dialogStyles.actions}>{children}</div>
}

export function AlertDialogClose(props: React.ComponentProps<typeof BaseAlertDialog.Close>) {
    return <BaseAlertDialog.Close {...props} />
}
