import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { queryTokens } from '@/lib/recipe/search'
import { requireSession } from '@/server/auth'
import { getStore } from '@/server/db'
import { listCollections, listRecipeCards, listTags } from '@/server/queries'
import { searchRecipeIds } from '@/server/search'
import { libraryIcons } from '../_library/icons'
import { Library } from '../_library/library'
import { LIBRARY_COOKIE, parseLibraryPrefs } from '../_library/library-data'

export const metadata: Metadata = { title: 'Library' }

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
    const [{ uid }, params, store] = await Promise.all([requireSession(), searchParams, getStore()])
    // A shared or reloaded search link renders with its ingredient matches already in place.
    const q = typeof params.q === 'string' ? params.q.slice(0, 200) : ''
    const searchKey = queryTokens(q).slice(0, 8).join(' ')
    const [recipes, collections, tags, jar, deepIds] = await Promise.all([
        listRecipeCards(uid),
        listCollections(uid),
        listTags(uid),
        cookies(),
        searchKey ? searchRecipeIds(store, uid, searchKey.split(' ')) : [],
    ])
    return (
        <Library
            recipes={recipes}
            collections={collections.map((c) => ({ id: c.id, name: c.name }))}
            tags={tags}
            prefs={parseLibraryPrefs(jar.get(LIBRARY_COOKIE)?.value)}
            icons={libraryIcons()}
            initialSearch={{ key: searchKey, ids: deepIds }}
        />
    )
}
