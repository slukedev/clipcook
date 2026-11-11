import { Skeleton } from '@/components/ui/skeleton'
import { PageTransition } from '@/components/ui/view-transition'
import styles from './clip.module.scss'

/** The clip entry's shape while the route loads. */
function Placeholder() {
    return (
        <section className={styles.page} aria-busy="true" aria-label="Clip a recipe">
            <div className={styles.entry}>
                <Skeleton shape="circle" width={88} height={88} className={styles.hero} />
                <Skeleton shape="pill" width={180} height={40} className={styles.modes} />
                <Skeleton shape="small" height={56} />
                <Skeleton shape="pill" height={56} />
            </div>
        </section>
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
