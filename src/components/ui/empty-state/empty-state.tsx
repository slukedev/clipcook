import { Icon, type IconName } from '../icon'
import styles from './empty-state.module.scss'

// M3 Expressive 12-scallop "cookie" blob behind the icon.
const COOKIE_PATH = (() => {
    const points: string[] = []
    const steps = 240
    for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2
        const r = 58 + 5.5 * Math.cos(12 * theta)
        const x = 64 + r * Math.cos(theta)
        const y = 64 + r * Math.sin(theta)
        points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
    }
    return `${points.join('')}Z`
})()

interface EmptyStateProps {
    icon: IconName
    headline: string
    body?: string
    /** Action buttons. */
    children?: React.ReactNode
}

/** Expressive empty/error state: scalloped tonal blob, headline, body, actions. */
export function EmptyState({ icon, headline, body, children }: EmptyStateProps) {
    return (
        <div className={styles.emptyState}>
            <div className={styles.art}>
                <svg viewBox="0 0 128 128" className={styles.cookie} aria-hidden="true">
                    <path d={COOKIE_PATH} fill="currentColor" />
                </svg>
                <Icon name={icon} size={48} className={styles.icon} />
            </div>
            <h2 className={styles.headline}>{headline}</h2>
            {body && <p className={styles.body}>{body}</p>}
            {children && <div className={styles.actions}>{children}</div>}
        </div>
    )
}
