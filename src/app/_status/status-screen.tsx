import type { ReactNode } from 'react'
import { cx } from '@/components/ui/cx'
import { Shape } from '@/components/ui/shape'
import type { ShapeName } from '@/components/ui/shape/shape-paths'
import styles from './status-screen.module.scss'

interface StatusScreenProps {
    shape: ShapeName
    icon: ReactNode
    title: string
    description?: string
    action?: ReactNode
    /** Fill the window (404, global error) instead of the content area. */
    fullscreen?: boolean
}

/** Not found and error screens: one shape, one heading, one way forward. */
export function StatusScreen({ shape, icon, title, description, action, fullscreen }: StatusScreenProps) {
    return (
        <div className={cx(styles.screen, fullscreen && styles.fullscreen)}>
            <div className={styles.art} aria-hidden>
                <Shape name={shape} className={styles.shape} />
                <span className={styles.icon}>{icon}</span>
            </div>
            <h1 className={styles.title}>{title}</h1>
            {description && <p className={styles.description}>{description}</p>}
            {action && <div className={styles.action}>{action}</div>}
        </div>
    )
}
