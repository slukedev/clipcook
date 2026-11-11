import { Skeleton } from '@/components/ui/skeleton'
import { TopAppBar } from '@/components/ui/top-app-bar'
import { PageTransition } from '@/components/ui/view-transition'
import styles from './displays.module.scss'

function DisplaysPlaceholder() {
    return (
        <div aria-busy="true">
            <TopAppBar variant="medium" title="Kitchen Displays" />
            <div className={styles.body}>
                <div className={styles.listPane}>
                    <div className={styles.listHeader}>
                        <Skeleton width={148} height={40} shape="pill" />
                    </div>
                    <div className={styles.skeletonList}>
                        <Skeleton height={88} shape="small" />
                        <Skeleton height={88} shape="small" />
                    </div>
                </div>
                <div className={styles.sidePane}>
                    <Skeleton height={360} shape="extra-large" />
                </div>
            </div>
        </div>
    )
}

/** Enters with the navigation's motion and crossfades into the page when it arrives. */
export default function Loading() {
    return (
        <PageTransition>
            <DisplaysPlaceholder />
        </PageTransition>
    )
}
