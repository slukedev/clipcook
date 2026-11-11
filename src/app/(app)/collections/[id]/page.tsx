import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { requireSession } from '@/server/auth'
import { getCollection, listCollections, listRecipes } from '@/server/queries'
import { libraryIcons } from '../../_library/icons'
import { LIBRARY_COOKIE, parseLibraryPrefs } from '../../_library/library-data'
import { CollectionView } from '../_components/collection-view'

interface Props {
    params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const [{ id }, { uid }] = await Promise.all([params, requireSession()])
    const found = await getCollection(uid, id)
    return { title: found?.collection.name ?? 'Collection' }
}

export default async function CollectionPage({ params }: Props) {
    const [{ id }, { uid }] = await Promise.all([params, requireSession()])
    const [found, recipes, collections, jar] = await Promise.all([
        getCollection(uid, id),
        listRecipes(uid),
        listCollections(uid),
        cookies(),
    ])
    if (!found) notFound()
    return (
        <CollectionView
            collection={{ id: found.collection.id, name: found.collection.name }}
            recipes={recipes}
            collections={collections.map((c) => ({ id: c.id, name: c.name }))}
            prefs={parseLibraryPrefs(jar.get(LIBRARY_COOKIE)?.value)}
            icons={libraryIcons()}
            backIcon={<Icon name="arrow_back" />}
            searchIcon={<Icon name="search" />}
        />
    )
}
