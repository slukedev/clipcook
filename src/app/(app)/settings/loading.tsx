import { Skeleton } from '@/components/ui/skeleton'
import styles from './_sections/sections.module.scss'

const GROUPS = [3, 1, 1, 2]

export default function Loading() {
    return (
        <div className={styles.page} role="status" aria-busy="true" aria-label="Loading settings">
            <Skeleton shape="text" className={styles.title} width={160} />
            {GROUPS.map((rows, g) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                <div key={g} className={styles.section}>
                    <Skeleton shape="text" className={styles.sectionTitle} width={120} />
                    {Array.from({ length: rows }, (_, r) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                        <Skeleton key={r} shape="large" height={72} />
                    ))}
                </div>
            ))}
        </div>
    )
}
