import { notFound } from 'next/navigation'
import { RecipeForm } from '@/app/(app)/RecipeForm'

export const metadata = { title: 'Form preview' }

/** Dev-only form layout preview (the real routes are auth-gated). */
export default function FormPreviewPage() {
    if (process.env.NODE_ENV === 'production') notFound()
    return (
        <RecipeForm
            mode="create"
            initial={{
                image: '',
                title: 'Weeknight carbonara',
                description: 'Fast, silky, and only five ingredients.',
                servings: '4',
                prepTime: '10 min',
                cookTime: '15 min',
                totalTime: '25 min',
                notes: '',
                ingredients: ['1 lb spaghetti', '4 egg yolks', '4 oz guanciale', '2 oz pecorino', 'Black pepper'],
                instructions: ['Boil the pasta.', 'Crisp the guanciale.', 'Temper the eggs and toss.'],
            }}
        />
    )
}
