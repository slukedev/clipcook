import type { Metadata } from 'next'
import { PageTransition } from '@/components/ui/view-transition'
import { requireSession } from '@/server/auth'
import { editorChoices } from '../_editor/data'
import { editorIcons } from '../_editor/icons'
import { RecipeEditor } from '../_editor/recipe-editor'
import { emptyValues } from '../_editor/values'

export const metadata: Metadata = { title: 'New recipe' }

export default async function NewRecipePage() {
    const session = await requireSession()
    const { tags, collections } = await editorChoices(session.uid)
    return (
        <PageTransition>
            <RecipeEditor
                heading="New recipe"
                initial={emptyValues()}
                initialPhoto={{ kind: 'none' }}
                tags={tags}
                collections={collections}
                icons={editorIcons()}
                closeHref="/"
            />
        </PageTransition>
    )
}
