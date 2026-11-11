'use client'

import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog'
import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import type { ReactNode } from 'react'
import { cx } from '../cx'
import { Glyph } from '../icon/glyph'
import { IconButton } from '../icon-button/icon-button'
import styles from './dialog.module.scss'

export const Dialog = BaseDialog.Root
export const DialogTrigger = BaseDialog.Trigger
export const DialogClose = BaseDialog.Close
export const AlertDialog = BaseAlertDialog.Root
export const AlertDialogTrigger = BaseAlertDialog.Trigger
export const AlertDialogClose = BaseAlertDialog.Close

export interface DialogContentProps {
    headline: ReactNode
    /** Hero icon above the headline; centers the dialog's text. */
    icon?: ReactNode
    children?: ReactNode
    /** Buttons, usually text buttons: dismiss first, confirm last. */
    actions?: ReactNode
    /**
     * Full screen on compact windows, with a close button and `fullScreenAction`
     * in a header row instead of the bottom actions.
     */
    fullScreen?: boolean
    /** The confirming action shown in the full-screen header ("Save"). */
    fullScreenAction?: ReactNode
    className?: string
}

/** Basic M3 dialog (or full-screen on compact). Put it inside `Dialog`. */
export function DialogContent({
    headline,
    icon,
    children,
    actions,
    fullScreen,
    fullScreenAction,
    className,
}: DialogContentProps) {
    const fs = fullScreen || undefined
    return (
        <BaseDialog.Portal>
            <BaseDialog.Backdrop className={styles.backdrop} />
            <BaseDialog.Viewport className={styles.viewport} data-fullscreen={fs}>
                <BaseDialog.Popup
                    className={cx(styles.popup, className)}
                    data-fullscreen={fs}
                    data-centered={icon ? '' : undefined}
                >
                    {fullScreen && (
                        <div className={styles.header}>
                            <BaseDialog.Close render={<IconButton label="Close" icon={<Glyph name="close" />} />} />
                            <span className={styles.headerTitle} aria-hidden>
                                {headline}
                            </span>
                            {fullScreenAction}
                        </div>
                    )}
                    {icon && <span className={styles.icon}>{icon}</span>}
                    <BaseDialog.Title className={styles.headline}>{headline}</BaseDialog.Title>
                    {children && <div className={styles.body}>{children}</div>}
                    {actions && <div className={styles.actions}>{actions}</div>}
                </BaseDialog.Popup>
            </BaseDialog.Viewport>
        </BaseDialog.Portal>
    )
}

export interface AlertDialogContentProps {
    headline: ReactNode
    icon?: ReactNode
    /** One or two short sentences. */
    children?: ReactNode
    /** Cancel (wrapped in `AlertDialogClose`) and the destructive or confirming action. */
    actions: ReactNode
    className?: string
}

/** A dialog that needs an answer before anything else; Escape and outside clicks do not close it. */
export function AlertDialogContent({ headline, icon, children, actions, className }: AlertDialogContentProps) {
    return (
        <BaseAlertDialog.Portal>
            <BaseAlertDialog.Backdrop className={styles.backdrop} />
            <BaseAlertDialog.Viewport className={styles.viewport}>
                <BaseAlertDialog.Popup className={cx(styles.popup, className)} data-centered={icon ? '' : undefined}>
                    {icon && <span className={styles.icon}>{icon}</span>}
                    <BaseAlertDialog.Title className={styles.headline}>{headline}</BaseAlertDialog.Title>
                    {children && (
                        <BaseAlertDialog.Description className={styles.body}>{children}</BaseAlertDialog.Description>
                    )}
                    <div className={styles.actions}>{actions}</div>
                </BaseAlertDialog.Popup>
            </BaseAlertDialog.Viewport>
        </BaseAlertDialog.Portal>
    )
}
