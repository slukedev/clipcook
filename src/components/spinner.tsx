'use client'

import type { HTMLAttributes } from 'react'
import styles from '@/styles/Components.module.scss'

export function Spinner(props: HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={styles.spinner} role="status" aria-label="Loading" {...props}>
            <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="20" />
            </svg>
        </div>
    )
}
