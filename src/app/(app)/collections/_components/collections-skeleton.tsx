import { Skeleton } from '@/components/ui/skeleton'
import type { ViewMode } from '../../_library/library-data'
import { RecipeGridSkeleton } from '../../_library/library-skeleton'
import page from './collection-view.module.scss'
import grid from './collections-grid.module.scss'

export function CollectionsSkeleton() {
    return (
        <div className={grid.page} role="status" aria-busy="true" aria-label="Loading collections">
            <div className={grid.header}>
                <Skeleton shape="text" className={grid.title} width={200} />
            </div>
            <ul className={grid.grid} aria-hidden>
                {Array.from({ length: 4 }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                    <li key={i} className={grid.card}>
                        <Skeleton className={grid.mosaicSkeleton} />
                        <div className={grid.text}>
                            <Skeleton shape="text" className={grid.name} width="64%" />
                            <Skeleton shape="text" className={grid.count} width="36%" />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    )
}

export function CollectionSkeleton({ view = 'grid' }: { view?: ViewMode }) {
    return (
        <div className={page.page} role="status" aria-busy="true" aria-label="Loading collection">
            <div className={page.header}>
                <Skeleton shape="circle" width={40} height={40} />
                <Skeleton shape="text" className={page.title} width="min(60%, 280px)" />
            </div>
            <RecipeGridSkeleton view={view} />
        </div>
    )
}
