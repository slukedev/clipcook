import { Skeleton } from '@/components/ui/skeleton'
import styles from './clip.module.scss'

/** The clip entry's shape while the route loads. */
export default function Loading() {
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
