import { Skeleton } from '@/components/ui/skeleton'
import browser from './recipe-browser.module.scss'
import card from './recipe-card.module.scss'
import styles from './library-skeleton.module.scss'

/** The recipe grid's placeholder: the same columns, photo boxes and text rows. */
export function RecipeGridSkeleton({ count = 12 }: { count?: number }) {
    return (
        <ul className={browser.items} data-view="grid" aria-hidden>
            {Array.from({ length: count }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                <li key={i}>
                    <div className={card.card} data-view="grid">
                        <Skeleton className={styles.media} />
                        <div className={card.text}>
                            <Skeleton shape="text" className={styles.title} width="82%" />
                            <Skeleton shape="text" className={styles.meta} width="56%" />
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    )
}

/** Library loading state: search bar, filter chips, then the grid. */
export function LibrarySkeleton() {
    return (
        <div className={styles.page} role="status" aria-busy="true" aria-label="Loading recipes">
            <div className={styles.header}>
                <Skeleton shape="pill" className={styles.search} />
                <div className={styles.chips}>
                    {[48, 88, 120, 96, 104].map((w) => (
                        <Skeleton key={w} shape="small" width={w} height={32} />
                    ))}
                </div>
                <div className={styles.tools} />
            </div>
            <RecipeGridSkeleton />
        </div>
    )
}
