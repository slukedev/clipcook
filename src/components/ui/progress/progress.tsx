'use client'

import { Progress as BaseProgress } from '@base-ui/react/progress'
import { cx } from '../cx'
import styles from './progress.module.scss'

interface LinearProgressProps {
    /** 0–100. Omit for indeterminate. */
    value?: number
    label?: string
    className?: string
}

/**
 * M3 Expressive linear progress: rounded indicator, gapped track,
 * stop dot at the end.
 */
export function LinearProgress({ value, label, className }: LinearProgressProps) {
    return (
        <BaseProgress.Root
            value={value ?? null}
            aria-label={label}
            className={cx(styles.root, value === undefined && styles.indeterminate, className)}
        >
            <BaseProgress.Track className={styles.track}>
                <BaseProgress.Indicator className={styles.indicator} />
            </BaseProgress.Track>
        </BaseProgress.Root>
    )
}

interface LoadingIndicatorProps {
    size?: 24 | 38 | 48
    label?: string
    className?: string
}

/** M3 circular activity indicator: rotating arc with a breathing sweep. */
export function LoadingIndicator({ size = 38, label = 'Loading', className }: LoadingIndicatorProps) {
    return (
        <span role="progressbar" aria-label={label} className={cx(styles.spinner, className)}>
            <svg viewBox="0 0 48 48" width={size} height={size} className={styles.spinnerSvg} aria-hidden="true">
                <circle className={styles.spinnerArc} cx="24" cy="24" r="20" fill="none" strokeWidth="4" />
            </svg>
        </span>
    )
}
