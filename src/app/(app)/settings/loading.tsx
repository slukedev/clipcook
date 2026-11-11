import { Skeleton } from '@/components/ui/skeleton'
import { PageTransition } from '@/components/ui/view-transition'
import styles from './_sections/sections.module.scss'

// Rows per section, as on the page: appearance, displays, clipping, data, account, about.
const GROUPS = [3, 1, 1, 2, 2, 3]

function Placeholder() {
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

/** Enters with the navigation's motion and crossfades into the page when it arrives. */
export default function Loading() {
    return (
        <PageTransition>
            <Placeholder />
        </PageTransition>
    )
}
