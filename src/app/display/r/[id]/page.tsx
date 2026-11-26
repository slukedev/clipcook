import { notFound, redirect } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { schemeDeclarations } from '@/lib/theme/scheme'
import { getDisplaySession } from '@/server/display-auth'
import { getRecipe } from '@/server/queries'
import { displayScheme } from '../../scheme'
import { DisplayRecipe } from './display-recipe'

export default async function DisplayRecipePage({ params }: { params: Promise<{ id: string }> }) {
    const [display, { id }] = await Promise.all([getDisplaySession(), params])
    if (!display) redirect('/display')
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound()
    const recipe = await getRecipe(display.uid, id)
    if (!recipe) redirect('/display')

    // The photo sets the palette; the display stays dark whatever the device prefers.
    const css =
        recipe.seedColor === null
            ? ''
            : `[data-display-recipe] {\n${schemeDeclarations(displayScheme(recipe.seedColor, { variant: 'content' }))}\n}`

    return (
        <>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: generated color tokens, no user input */}
            {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
            <DisplayRecipe
                key={recipe.id}
                recipe={recipe}
                icons={{
                    next: <Icon name="arrow_forward" />,
                    prev: <Icon name="arrow_back" />,
                    start: <Icon name="play_arrow" />,
                    overview: <Icon name="format_list_bulleted" />,
                    timer: <Icon name="timer" />,
                    pause: <Icon name="pause" />,
                    play: <Icon name="play_arrow" />,
                    close: <Icon name="close" />,
                    time: <Icon name="schedule" />,
                    servings: <Icon name="restaurant" />,
                    check: <Icon name="check" />,
                    home: <Icon name="arrow_back" />,
                }}
            />
        </>
    )
}
