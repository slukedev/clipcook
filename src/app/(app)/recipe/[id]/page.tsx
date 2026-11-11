import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getThemePreference } from '@/lib/theme/server'
import { recipeColorCss } from '@/lib/cook/color'
import { requireSession } from '@/server/auth'
import { getRecipe, listCollections } from '@/server/queries'
import { recipeIdSchema } from '@/server/schemas'
import { displayOptions } from './_view/display-options'
import { RecipeScreen } from './_view/recipe-screen'
import './_view/view-transitions.css'

type Props = { params: Promise<{ id: string }> }

async function load(id: string) {
    const parsed = recipeIdSchema.safeParse(id)
    if (!parsed.success) return null
    const session = await requireSession()
    return getRecipe(session.uid, parsed.data)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const recipe = await load((await params).id).catch(() => null)
    if (!recipe) return { title: 'Recipe' }
    return { title: recipe.title, description: recipe.description || undefined }
}

export default async function RecipePage({ params }: Props) {
    const { id } = await params
    const parsed = recipeIdSchema.safeParse(id)
    if (!parsed.success) notFound()
    const session = await requireSession()
    const [recipe, displays, collections, preference] = await Promise.all([
        getRecipe(session.uid, parsed.data),
        displayOptions(session.uid),
        listCollections(session.uid),
        getThemePreference(),
    ])
    if (!recipe) notFound()

    // The page re-themes from the photo on the server, so the first paint is already in color.
    const css = recipe.seedColor === null ? null : recipeColorCss(recipe.id, recipe.seedColor, preference.contrast)

    return (
        <RecipeScreen
            recipe={recipe}
            colorCss={css}
            displays={displays}
            collections={collections.map((c) => ({ id: c.id, name: c.name }))}
        />
    )
}
