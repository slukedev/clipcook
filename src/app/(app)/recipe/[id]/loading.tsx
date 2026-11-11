import { Skeleton } from '@/components/ui/skeleton'
import styles from './_view/recipe-screen.module.scss'
import skeleton from './_view/skeleton.module.scss'

const ROWS = ['a', 'b', 'c', 'd', 'e', 'f']
const STEPS = ['a', 'b', 'c', 'd']

/** The recipe layout with placeholders, pane for pane, while the recipe streams in. */
export default function Loading() {
    return (
        <section className={styles.root} data-has-photo="" aria-busy="true" aria-label="Loading recipe">
            <div className={skeleton.bar}>
                <Skeleton shape="circle" width={40} height={40} />
                <span className={skeleton.spacer} />
                <Skeleton shape="circle" width={40} height={40} />
                <Skeleton shape="circle" width={40} height={40} />
                <Skeleton shape="circle" width={40} height={40} />
            </div>
            <div className={styles.layout}>
                <div className={styles.lead}>
                    <div className={styles.header}>
                        <div className={styles.photoFrame}>
                            <Skeleton className={skeleton.fill} />
                        </div>
                        <div className={styles.summary}>
                            <Skeleton className={styles.title} shape="text" lines={2} width="90%" />
                            <Skeleton shape="text" width={120} />
                            <Skeleton shape="text" lines={2} width="100%" />
                            <div className={styles.stats}>
                                <Skeleton shape="large" width={88} height={60} />
                                <Skeleton shape="large" width={88} height={60} />
                                <Skeleton shape="large" width={88} height={60} />
                            </div>
                            <Skeleton className={styles.cook} shape="pill" height={56} />
                        </div>
                    </div>
                    <div className={skeleton.panel}>
                        <Skeleton shape="text" width={160} height={32} />
                        <Skeleton shape="pill" width={220} height={40} />
                        <div className={skeleton.rows}>
                            {ROWS.map((key) => (
                                <Skeleton key={key} shape="small" height={56} />
                            ))}
                        </div>
                    </div>
                </div>
                <div className={styles.main}>
                    <Skeleton shape="text" width={120} height={32} />
                    {STEPS.map((key) => (
                        <div key={key} className={skeleton.step}>
                            <Skeleton shape="circle" width={44} height={44} />
                            <Skeleton shape="text" lines={3} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
