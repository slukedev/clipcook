import { ChipSet } from '@/components/ui/chip'
import { cx } from '@/components/ui/cx'
import { Skeleton } from '@/components/ui/skeleton'
import type { ViewMode } from './library-data'
import browser from './recipe-browser.module.scss'
import card from './recipe-card.module.scss'
import library from './library.module.scss'
import styles from './library-skeleton.module.scss'

/** The recipe grid or list placeholder: the same columns, photo boxes and text rows as the real cards. */
export function RecipeGridSkeleton({ count = 12, view = 'grid' }: { count?: number; view?: ViewMode }) {
    return (
        <ul className={browser.items} data-view={view} aria-hidden>
            {Array.from({ length: count }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                <li key={i}>
                    <div className={card.card} data-view={view}>
                        <Skeleton className={cx(card.media, styles.media)} />
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

/** Library loading state: the real page frame (search, chips, tools) around the remembered view. */
export function LibrarySkeleton({ view = 'grid' }: { view?: ViewMode }) {
    return (
        <div className={library.page} role="status" aria-busy="true" aria-label="Loading recipes">
            <div className={library.header}>
                <div className={library.searchRow}>
                    <Skeleton shape="pill" className={cx(library.search, styles.search)} />
                </div>
                <ChipSet scroll bleed aria-hidden>
                    {[48, 96, 112, 120, 104, 72].map((w) => (
                        <Skeleton key={w} shape="small" width={w} height={32} className={styles.chip} />
                    ))}
                </ChipSet>
                <div className={library.toolRow}>
                    <span className={library.count} />
                </div>
            </div>
            <RecipeGridSkeleton view={view} />
        </div>
    )
}
