import { notFound } from 'next/navigation'
import { requireSession } from '@/server/auth'
import { getRecipeForUser } from '@/server/recipes'
import { recipeIdSchema } from '@/server/schemas'
import { RecipeForm, type RecipeFormValues } from '@/app/(app)/RecipeForm'

export const dynamic = 'force-dynamic'

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const parsed = recipeIdSchema.safeParse(id)
    if (!parsed.success) notFound()
    const session = await requireSession()
    const recipe = await getRecipeForUser(session.uid, parsed.data)
    if (!recipe) notFound()

    const initial: RecipeFormValues = {
        image: recipe.image,
        title: recipe.title,
        description: recipe.description,
        servings: String(recipe.servings ?? ''),
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        totalTime: recipe.totalTime,
        notes: recipe.notes ?? '',
        ingredients: recipe.ingredients.length > 0 ? recipe.ingredients : [''],
        instructions: recipe.instructions.length > 0 ? recipe.instructions : [''],
    }

    return <RecipeForm mode="edit" recipeId={recipe.id} initial={initial} />
}
