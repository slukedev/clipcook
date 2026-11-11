'use client'

import { Toast } from '@base-ui/react/toast'
import { createContext, type ReactNode, use, useEffect, useRef } from 'react'
import { Glyph } from '../icon/glyph'
import styles from './snackbar.module.scss'

export interface SnackbarOptions {
    message: string
    /** Action label ("Undo", "Retry"). */
    action?: string
    onAction?: () => void
    /** Show a close button (long or important messages). */
    closable?: boolean
    /** Milliseconds; 0 stays until dismissed. Defaults to 4000, or 8000 with an action. */
    duration?: number
    /** Announce assertively (errors). */
    urgent?: boolean
}

type Show = (options: SnackbarOptions | string) => void

const SnackbarContext = createContext<Show | null>(null)

/** Shows snackbars one at a time, in order. Mount once near the root. */
export function SnackbarProvider({ children }: { children: ReactNode }) {
    return (
        <Toast.Provider limit={1}>
            <Queue>{children}</Queue>
            <Toast.Portal>
                <Toast.Viewport className={styles.viewport}>
                    <SnackbarList />
                </Toast.Viewport>
            </Toast.Portal>
        </Toast.Provider>
    )
}

function Queue({ children }: { children: ReactNode }) {
    const manager = Toast.useToastManager()
    const queue = useRef<SnackbarOptions[]>([])
    const active = useRef(false)

    const next = () => {
        const options = queue.current.shift()
        if (!options) {
            active.current = false
            return
        }
        active.current = true
        manager.add({
            description: options.message,
            timeout: options.duration ?? (options.action ? 8000 : 4000),
            priority: options.urgent ? 'high' : 'low',
            data: { closable: options.closable ?? false },
            actionProps: options.action ? { children: options.action, onClick: () => options.onAction?.() } : undefined,
            onRemove: next,
        })
    }

    const show: Show = (input) => {
        queue.current.push(typeof input === 'string' ? { message: input } : input)
        if (!active.current) next()
    }

    return <SnackbarContext value={show}>{children}</SnackbarContext>
}

// Timers should not run out while nobody can see the message.
function usePauseWhenHidden() {
    useEffect(() => {
        const onVisibility = () => {
            const event = new FocusEvent(document.hidden ? 'blur' : 'focus')
            window.dispatchEvent(event)
        }
        document.addEventListener('visibilitychange', onVisibility)
        return () => document.removeEventListener('visibilitychange', onVisibility)
    }, [])
}

function SnackbarList() {
    const { toasts } = Toast.useToastManager()
    usePauseWhenHidden()
    return toasts.map((toast) => (
        <Toast.Root key={toast.id} toast={toast} className={styles.snackbar} swipeDirection={['down', 'left', 'right']}>
            <Toast.Content className={styles.content}>
                <Toast.Description className={styles.message} />
                {toast.actionProps && <Toast.Action className={styles.action} />}
                {(toast.data as { closable?: boolean } | undefined)?.closable && (
                    <Toast.Close className={styles.close} aria-label="Dismiss">
                        <Glyph name="close" />
                    </Toast.Close>
                )}
            </Toast.Content>
        </Toast.Root>
    ))
}

/** `const snackbar = useSnackbar(); snackbar({ message: 'Saved' })`. */
export function useSnackbar(): Show {
    const show = use(SnackbarContext)
    if (!show) throw new Error('useSnackbar must be used inside <SnackbarProvider>')
    return show
}
