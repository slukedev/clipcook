import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { displayOptions } from '@/app/(app)/recipe/[id]/_view/display-options'
import { recipeIcons } from '@/app/(app)/recipe/[id]/_view/icons'
import { Icon } from '@/components/ui/icon'
import { recipeColorCss } from '@/lib/cook/color'
import { deriveTotalMinutes, formatMinutes } from '@/lib/recipe/time'
import { getThemePreference } from '@/lib/theme/server'
import { requireSession } from '@/server/auth'
import { getRecipe } from '@/server/queries'
import { recipeIdSchema } from '@/server/schemas'
import { CookMode } from './_cook/cook-mode'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const parsed = recipeIdSchema.safeParse((await params).id)
    if (!parsed.success) return { title: 'Cook' }
    const session = await requireSession().catch(() => null)
    const recipe = session ? await getRecipe(session.uid, parsed.data).catch(() => null) : null
    return { title: recipe ? `Cook: ${recipe.title}` : 'Cook' }
}

export default async function CookPage({ params }: Props) {
    const parsed = recipeIdSchema.safeParse((await params).id)
    if (!parsed.success) notFound()
    const session = await requireSession()
    const [recipe, displays, preference] = await Promise.all([
        getRecipe(session.uid, parsed.data),
        displayOptions(session.uid),
        getThemePreference(),
    ])
    if (!recipe) notFound()

    const css = recipe.seedColor === null ? null : recipeColorCss(recipe.id, recipe.seedColor, preference.contrast)
    const icons = recipeIcons()

    return (
        <>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: generated color tokens, id is validated */}
            {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
            <CookMode
                recipe={{
                    id: recipe.id,
                    title: recipe.title,
                    servings: recipe.servings,
                    ingredients: recipe.ingredients,
                    instructions: recipe.instructions,
                    totalMinutes: recipe.totalMinutes ?? deriveTotalMinutes(recipe),
                    totalTime: recipe.totalMinutes ? formatMinutes(recipe.totalMinutes) : recipe.totalTime,
                }}
                displays={displays}
                icons={{
                    close: icons.close,
                    list: icons.list,
                    // Hands-free is a toggle: an outlined mic while off, a filled one while listening.
                    mic: <Icon name="mic" filled />,
                    micOff: icons.mic,
                    cast: icons.cast,
                    castConnected: icons.castConnected,
                    tv: icons.tv,
                    timer: icons.timer,
                    play: icons.play,
                    pause: icons.pause,
                    back: icons.back,
                    next: icons.next,
                    check: icons.check,
                    volume: icons.volume,
                    restart: icons.restart,
                    schedule: <Icon name="schedule" />,
                }}
            />
        </>
    )
}
