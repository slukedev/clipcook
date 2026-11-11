import 'server-only'

import { listCollections, listTags } from '@/server/queries'
import type { EditorCollection } from './values'

/** Tag suggestions and collection choices for the editor. */
export async function editorChoices(uid: string): Promise<{ tags: string[]; collections: EditorCollection[] }> {
    const [tags, collections] = await Promise.all([listTags(uid), listCollections(uid)])
    return {
        tags: tags.map((t) => t.tag),
        collections: collections.map((c) => ({ id: c.id, name: c.name })),
    }
}
