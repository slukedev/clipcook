import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { dynamicColorCss } from '@/lib/theme/scheme'
import { requireSession } from '@/server/auth'
import { getRecipeForUser } from '@/server/recipes'
import { recipeIdSchema } from '@/server/schemas'
import { RecipeView } from './RecipeView'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params
    const parsed = recipeIdSchema.safeParse(id)
    if (!parsed.success) return { title: 'ClipCook' }
    try {
        const session = await requireSession()
        const recipe = await getRecipeForUser(session.uid, parsed.data)
        if (recipe) return { title: recipe.title }
    } catch {
        // fall through
    }
    return { title: 'ClipCook' }
}

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const parsed = recipeIdSchema.safeParse(id)
    if (!parsed.success) notFound()
    const session = await requireSession()
    const recipe = await getRecipeForUser(session.uid, parsed.data)
    if (!recipe) notFound()

    // Per-recipe dynamic color, rendered on the server: the whole page below
    // the app bar re-themes from the photo's seed color, in both schemes,
    // with zero client color computation and no flash.
    const dynamicCss = recipe.seedColor !== null ? dynamicColorCss('[data-recipe-scope]', recipe.seedColor) : null

    return (
        <>
            {dynamicCss && <style>{dynamicCss}</style>}
            <RecipeView recipe={recipe} />
        </>
    )
}
