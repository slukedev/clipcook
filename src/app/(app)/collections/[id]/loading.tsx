import { cookies } from 'next/headers'
import { PageTransition } from '@/components/ui/view-transition'
import { LIBRARY_COOKIE, parseLibraryPrefs } from '../../_library/library-data'
import { CollectionSkeleton } from '../_components/collections-skeleton'

async function Placeholder() {
    const { view } = parseLibraryPrefs((await cookies()).get(LIBRARY_COOKIE)?.value)
    return <CollectionSkeleton view={view} />
}

/** Enters with the navigation's motion and crossfades into the page when it arrives. */
export default function Loading() {
    return (
        <PageTransition>
            <Placeholder />
        </PageTransition>
    )
}
