'use client'

import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { cx } from '../cx'
import { Icon, type IconName } from '../icon'
import styles from './dialog.module.scss'

/** Root — controls open state. */
export const Dialog = BaseDialog.Root

/** Wrap any element to make it open the dialog. */
export function DialogTrigger(props: React.ComponentProps<typeof BaseDialog.Trigger>) {
    return <BaseDialog.Trigger {...props} />
}

interface DialogContentProps {
    children: React.ReactNode
    /** Full-screen on compact windows, large dialog on medium+. */
    fullScreen?: boolean
    className?: string
}

/** Portal + scrim + M3 popup surface. */
export function DialogContent({ children, fullScreen = false, className }: DialogContentProps) {
    return (
        <BaseDialog.Portal>
            <BaseDialog.Backdrop className={styles.scrim} />
            <BaseDialog.Popup className={cx(styles.popup, fullScreen && styles.fullScreen, className)}>
                {children}
            </BaseDialog.Popup>
        </BaseDialog.Portal>
    )
}

/** Optional hero icon — centers the headline per M3. */
export function DialogIcon({ name }: { name: IconName }) {
    return (
        <div className={styles.heroIcon}>
            <Icon name={name} />
        </div>
    )
}

export function DialogHeadline({ children }: { children: React.ReactNode }) {
    return <BaseDialog.Title className={styles.headline}>{children}</BaseDialog.Title>
}

export function DialogBody({ children }: { children: React.ReactNode }) {
    return (
        <BaseDialog.Description render={<div />} className={styles.body}>
            {children}
        </BaseDialog.Description>
    )
}

export function DialogActions({ children }: { children: React.ReactNode }) {
    return <div className={styles.actions}>{children}</div>
}

/** Wrap a Button to make it close the dialog. */
export function DialogClose(props: React.ComponentProps<typeof BaseDialog.Close>) {
    return <BaseDialog.Close {...props} />
}

interface FullScreenDialogHeaderProps {
    title: React.ReactNode
    /** Confirmation action (e.g. a Save button). */
    action?: React.ReactNode
}

/** Header row for full-screen dialogs: close, title, action. */
export function FullScreenDialogHeader({ title, action }: FullScreenDialogHeaderProps) {
    return (
        <header className={styles.fullScreenHeader}>
            <BaseDialog.Close className={styles.fullScreenClose} aria-label="Close">
                <Icon name="close" />
            </BaseDialog.Close>
            <BaseDialog.Title className={styles.fullScreenTitle}>{title}</BaseDialog.Title>
            {action}
        </header>
    )
}
