import { cookies } from 'next/headers'
import { LIBRARY_COOKIE, parseLibraryPrefs } from '../_library/library-data'
import { LibrarySkeleton } from '../_library/library-skeleton'

export default async function Loading() {
    const { view } = parseLibraryPrefs((await cookies()).get(LIBRARY_COOKIE)?.value)
    return <LibrarySkeleton view={view} />
}
