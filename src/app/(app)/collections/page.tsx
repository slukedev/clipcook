import type { Metadata } from 'next'
import { Icon } from '@/components/ui/icon'
import { requireSession } from '@/server/auth'
import { listCollections } from '@/server/queries'
import { CollectionsGrid } from './_components/collections-grid'

export const metadata: Metadata = { title: 'Collections' }

export default async function CollectionsPage() {
    const { uid } = await requireSession()
    const collections = await listCollections(uid)
    return (
        <CollectionsGrid
            collections={collections}
            icons={{
                add: <Icon name="add" />,
                more: <Icon name="more_vert" />,
                edit: <Icon name="edit" />,
                delete: <Icon name="delete" />,
                empty: <Icon name="collections_bookmark" />,
            }}
        />
    )
}
