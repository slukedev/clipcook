import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { requireSession } from '@/server/auth'
import { listCollections, listRecipeCards, listTags } from '@/server/queries'
import { libraryIcons } from '../_library/icons'
import { Library } from '../_library/library'
import { LIBRARY_COOKIE, parseLibraryPrefs } from '../_library/library-data'

export const metadata: Metadata = { title: 'Library' }

export default async function LibraryPage() {
    const { uid } = await requireSession()
    const [recipes, collections, tags, jar] = await Promise.all([
        listRecipeCards(uid),
        listCollections(uid),
        listTags(uid),
        cookies(),
    ])
    return (
        <Library
            recipes={recipes}
            collections={collections.map((c) => ({ id: c.id, name: c.name }))}
            tags={tags}
            prefs={parseLibraryPrefs(jar.get(LIBRARY_COOKIE)?.value)}
            icons={libraryIcons()}
        />
    )
}
