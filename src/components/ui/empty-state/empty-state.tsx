import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx'
import { Shape } from '../shape/shape'
import type { ShapeName } from '../shape/shape-paths'
import styles from './empty-state.module.scss'

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    /** MaterialShape behind the icon. */
    shape?: ShapeName
    icon?: ReactNode
    title: ReactNode
    /** One short line, only when the title cannot stand alone. */
    description?: ReactNode
    /** The one next step, usually a Button. */
    action?: ReactNode
    /** Heading level for the title. */
    titleAs?: 'h2' | 'h3' | 'p'
}

export function EmptyState({
    shape = 'cookie9',
    icon,
    title,
    description,
    action,
    titleAs: Title = 'h2',
    className,
    ...rest
}: EmptyStateProps) {
    return (
        <div className={cx(styles.root, className)} {...rest}>
            <div className={styles.art} aria-hidden>
                <Shape name={shape} className={styles.shape} />
                {icon && <span className={styles.icon}>{icon}</span>}
            </div>
            <Title className={styles.title}>{title}</Title>
            {description && <p className={styles.description}>{description}</p>}
            {action && <div className={styles.action}>{action}</div>}
        </div>
    )
}
