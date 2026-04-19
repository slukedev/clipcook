import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { requireSession } from '@/server/auth'
import { getRecipeForUser } from '@/server/recipes'
import { recipeIdSchema } from '@/server/schemas'
import { RecipeView } from './RecipeView'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>
}): Promise<Metadata> {
    const { id } = await params
    const parsed = recipeIdSchema.safeParse(id)
    if (!parsed.success) return { title: 'ClipCook' }
    try {
        const session = await requireSession()
        const recipe = await getRecipeForUser(session.uid, parsed.data)
        if (recipe) return { title: `ClipCook – ${recipe.title}` }
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
    return <RecipeView recipe={recipe} />
}
