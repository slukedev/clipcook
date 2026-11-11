import { Skeleton } from '@/components/ui/skeleton'
import { TopAppBar } from '@/components/ui/top-app-bar'
import { PageTransition } from '@/components/ui/view-transition'
import styles from './grocery.module.scss'

const GROUPS = [
    { key: 'a', rows: ['a1', 'a2', 'a3', 'a4'] },
    { key: 'b', rows: ['b1', 'b2'] },
    { key: 'c', rows: ['c1', 'c2', 'c3'] },
]

function GroceryPlaceholder() {
    return (
        <div className={styles.page} aria-busy="true">
            <TopAppBar variant="medium" title="Grocery List" />
            <div className={styles.body}>
                <div className={styles.top}>
                    <Skeleton height={56} shape="pill" />
                </div>
                <div className={styles.groups}>
                    {GROUPS.map((group) => (
                        <div key={group.key} className={styles.group}>
                            <div className={styles.groupHeader}>
                                <Skeleton width={32} height={32} shape="medium" />
                                <Skeleton width={112} height={20} shape="small" />
                            </div>
                            <div className={styles.skeletonRows}>
                                {group.rows.map((row) => (
                                    <Skeleton key={row} height={56} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

/** Enters with the navigation's motion and crossfades into the page when it arrives. */
export default function Loading() {
    return (
        <PageTransition>
            <GroceryPlaceholder />
        </PageTransition>
    )
}
