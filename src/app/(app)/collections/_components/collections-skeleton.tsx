import { Skeleton } from '@/components/ui/skeleton'
import type { ViewMode } from '../../_library/library-data'
import { RecipeGridSkeleton } from '../../_library/library-skeleton'
import grid from './collections-grid.module.scss'
import page from './collection-view.module.scss'

export function CollectionsSkeleton() {
    return (
        <div className={grid.page} role="status" aria-busy="true" aria-label="Loading collections">
            <div className={grid.header}>
                <Skeleton shape="text" className={grid.title} width={200} />
            </div>
            <RecipeGridSkeleton count={8} />
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
