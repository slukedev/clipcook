'use client'

import { Toast } from '@base-ui/react/toast'
import { useCallback } from 'react'
import styles from './snackbar.module.scss'

interface SnackbarAction {
    label: string
    onClick: () => void
}

/**
 * Mount once near the app root. Children get `useSnackbar()`.
 */
export function SnackbarProvider({ children }: { children: React.ReactNode }) {
    return (
        <Toast.Provider limit={1} timeout={5000}>
            {children}
            <Toast.Portal>
                <Toast.Viewport className={styles.viewport}>
                    <SnackbarList />
                </Toast.Viewport>
            </Toast.Portal>
        </Toast.Provider>
    )
}

function SnackbarList() {
    const { toasts } = Toast.useToastManager()
    return toasts.map((toast) => (
        <Toast.Root key={toast.id} toast={toast} className={styles.snackbar} swipeDirection="down">
            <Toast.Description className={styles.message} />
            {(toast.data as { action?: SnackbarAction } | undefined)?.action && (
                <Toast.Action className={styles.action} />
            )}
        </Toast.Root>
    ))
}

/** `const snackbar = useSnackbar(); snackbar.show('Saved')` */
export function useSnackbar() {
    const manager = Toast.useToastManager()

    const show = useCallback(
        (message: string, options?: { action?: SnackbarAction }) => {
            manager.add({
                description: message,
                data: options?.action ? { action: options.action } : undefined,
                actionProps: options?.action
                    ? {
                          children: options.action.label,
                          onClick: options.action.onClick,
                      }
                    : undefined,
            })
        },
        [manager],
    )

    return { show }
}
