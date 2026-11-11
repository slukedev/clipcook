import { cookies } from 'next/headers'
import { LIBRARY_COOKIE, parseLibraryPrefs } from '../../_library/library-data'
import { CollectionSkeleton } from '../_components/collections-skeleton'

export default async function Loading() {
    const { view } = parseLibraryPrefs((await cookies()).get(LIBRARY_COOKIE)?.value)
    return <CollectionSkeleton view={view} />
}
