import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageTransition } from '@/components/ui/view-transition'
import { dynamicColorCss } from '@/lib/theme/scheme'
import { getThemePreference } from '@/lib/theme/server'
import { requireSession } from '@/server/auth'
import { getRecipe } from '@/server/queries'
import { idSchema } from '@/server/schemas'
import { editorChoices } from '../../../_editor/data'
import { editorIcons } from '../../../_editor/icons'
import { RecipeEditor } from '../../../_editor/recipe-editor'
import { EDITOR_SCOPE, valuesFromRecipe } from '../../../_editor/values'

export const metadata: Metadata = { title: 'Edit recipe' }

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const parsed = idSchema.safeParse(id)
    if (!parsed.success) notFound()
    const session = await requireSession()
    const [recipe, choices, preference] = await Promise.all([
        getRecipe(session.uid, parsed.data),
        editorChoices(session.uid),
        getThemePreference(),
    ])
    if (!recipe) notFound()

    const colorCss =
        recipe.image && recipe.seedColor !== null
            ? dynamicColorCss(EDITOR_SCOPE, recipe.seedColor, { contrast: preference.contrast })
            : ''

    return (
        <PageTransition>
            <RecipeEditor
                recipeId={recipe.id}
                heading="Edit recipe"
                initial={valuesFromRecipe(recipe)}
                initialPhoto={recipe.image ? { kind: 'existing', src: recipe.image } : { kind: 'none' }}
                initialColorCss={colorCss}
                tags={choices.tags}
                collections={choices.collections}
                icons={editorIcons()}
                closeHref={`/recipe/${recipe.id}`}
            />
        </PageTransition>
    )
}
