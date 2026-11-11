import { cookies } from 'next/headers'
import { LibrarySkeleton } from '../_library/library-skeleton'
import { LIBRARY_COOKIE, parseLibraryPrefs } from '../_library/library-data'

export default async function Loading() {
    const { view } = parseLibraryPrefs((await cookies()).get(LIBRARY_COOKIE)?.value)
    return <LibrarySkeleton view={view} />
}
