import { Skeleton } from '@/components/ui/skeleton'
import { TopAppBar } from '@/components/ui/top-app-bar'
import { PageTransition } from '@/components/ui/view-transition'
import styles from './_sections/sections.module.scss'

// Rows per section, as on the page: appearance, meal plan, displays, clipping, data, account, about.
const GROUPS = [3, 1, 1, 1, 2, 2, 3]

function Placeholder() {
    return (
        <div className={styles.screen} role="status" aria-busy="true" aria-label="Loading settings">
            <TopAppBar variant="medium" title="Settings" />
            <div className={styles.page}>
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
