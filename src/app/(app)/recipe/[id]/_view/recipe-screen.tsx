import Link from 'next/link'
import { type CSSProperties, ViewTransition } from 'react'
import { CastButton } from '@/components/kitchen/cast-button'
import { Button } from '@/components/ui/button'
import { AssistChip, ChipSet } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { PageTransition, SharedElement, vtName } from '@/components/ui/view-transition'
import type { Recipe } from '@/lib/domain/types'
import { prettifyFractions } from '@/lib/recipe/ingredients'
import { recipeIcons } from './icons'
import { IngredientsPanel } from './ingredients-panel'
import { RecipeActions } from './recipe-actions'
import { RecipePhoto } from './recipe-photo'
import styles from './recipe-screen.module.scss'
import { StepsList } from './steps-list'
import { TimerTray } from './timer-tray'
import { TopBar } from './top-bar'
import type { CollectionOption, DisplayOption } from './types'

function sourceLabel(recipe: Recipe): string | null {
    if (recipe.sourceName) return recipe.sourceName
    if (!recipe.sourceUrl) return null
    try {
        return new URL(recipe.sourceUrl).hostname.replace(/^www\./, '')
    } catch {
        return null
    }
}

export function RecipeScreen({
    recipe,
    colorCss,
    displays,
    collections,
}: {
    recipe: Recipe
    colorCss: string | null
    displays: DisplayOption[]
    collections: CollectionOption[]
}) {
    const icons = recipeIcons()
    const source = sourceLabel(recipe)
    const titleId = `recipe-title-${recipe.id}`
    const stats = [
        { label: 'Prep', value: recipe.prepTime },
        { label: 'Cook', value: recipe.cookTime },
        { label: 'Total', value: recipe.totalTime },
        { label: 'Serves', value: recipe.servings },
    ].filter((s) => s.value)
    const memberOf = collections.filter((c) => recipe.collectionIds.includes(c.id))
    const hasSteps = recipe.instructions.some((line) => line.trim() && !line.startsWith('# '))

    return (
        <PageTransition>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: generated color tokens, id is validated */}
            {colorCss && <style dangerouslySetInnerHTML={{ __html: colorCss }} />}
            <div className={styles.root} data-recipe={recipe.id} data-has-photo={recipe.image ? '' : undefined}>
                <TopBar
                    title={recipe.title}
                    titleId={titleId}
                    back={icons.back}
                    trailing={
                        <RecipeActions
                            recipe={{
                                id: recipe.id,
                                title: recipe.title,
                                favorite: recipe.favorite,
                                collectionIds: recipe.collectionIds,
                                sourceUrl: recipe.sourceUrl,
                                servings: recipe.servings,
                                ingredients: recipe.ingredients,
                                instructions: recipe.instructions,
                                notes: recipe.notes,
                            }}
                            displays={displays}
                            castSlot={
                                process.env.NEXT_PUBLIC_CAST_APP_ID ? (
                                    <CastButton recipeId={recipe.id} icon={icons.cast} />
                                ) : undefined
                            }
                            collections={collections}
                            icons={{
                                favorite: icons.favorite,
                                favoriteFilled: icons.favoriteFilled,
                                cast: icons.cast,
                                castConnected: icons.castConnected,
                                more: icons.more,
                                edit: icons.edit,
                                copy: icons.copy,
                                folder: icons.folder,
                                share: icons.share,
                                print: icons.print,
                                delete: icons.delete,
                                add: icons.add,
                                tv: icons.tv,
                            }}
                        />
                    }
                />
                <TimerTray recipeId={recipe.id} icons={{ timer: icons.timer, play: icons.play, pause: icons.pause }} />
                <article className={styles.layout} aria-labelledby={titleId}>
                    <div className={styles.lead}>
                        <header className={styles.header}>
                            <div className={styles.photoFrame}>
                                <SharedElement name={vtName('recipe-photo', recipe.id)}>
                                    <div className={styles.photo}>
                                        <RecipePhoto
                                            id={recipe.id}
                                            src={recipe.image}
                                            alt=""
                                            sizes="(width < 720px) 100vw, 480px"
                                        />
                                    </div>
                                </SharedElement>
                            </div>
                            <div className={styles.summary} data-bar-sentinel>
                                <SharedElement name={vtName('recipe-title', recipe.id)}>
                                    <h1 id={titleId} className={styles.title}>
                                        {recipe.title}
                                    </h1>
                                </SharedElement>
                                {source && recipe.sourceUrl && (
                                    <a
                                        className={styles.source}
                                        href={recipe.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {source}
                                        <Icon name="open_in_new" size={16} />
                                    </a>
                                )}
                                {source && !recipe.sourceUrl && <p className={styles.sourceText}>{source}</p>}
                                {recipe.description && <p className={styles.description}>{recipe.description}</p>}
                                {stats.length > 0 && (
                                    <dl
                                        className={styles.stats}
                                        style={{ '--_count': stats.length } as CSSProperties}
                                    >
                                        {stats.map((s) => (
                                            <div key={s.label} className={styles.stat}>
                                                <dt>{s.label}</dt>
                                                <dd>{prettifyFractions(s.value)}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}
                                {hasSteps && (
                                    <ViewTransition name={vtName('cook', recipe.id)} share="cc-cook" default="none">
                                        <Button
                                            className={styles.cook}
                                            size="m"
                                            icon={icons.cook}
                                            render={
                                                <Link href={`/recipe/${recipe.id}/cook`} transitionTypes={['cook']} />
                                            }
                                            nativeButton={false}
                                        >
                                            Cook
                                        </Button>
                                    </ViewTransition>
                                )}
                                {(recipe.tags.length > 0 || memberOf.length > 0) && (
                                    <ChipSet className={styles.chips} label="Tags and collections">
                                        {memberOf.map((c) => (
                                            <AssistChip
                                                key={c.id}
                                                icon={<Icon name="folder" />}
                                                render={<Link href={`/collections/${c.id}`} />}
                                                nativeButton={false}
                                            >
                                                {c.name}
                                            </AssistChip>
                                        ))}
                                        {recipe.tags.map((tag) => (
                                            <AssistChip
                                                key={tag}
                                                icon={<Icon name="sell" />}
                                                render={<Link href={`/?tag=${encodeURIComponent(tag)}`} />}
                                                nativeButton={false}
                                            >
                                                {tag}
                                            </AssistChip>
                                        ))}
                                    </ChipSet>
                                )}
                            </div>
                        </header>
                        <div className={styles.ingredients}>
                            <IngredientsPanel
                                recipeId={recipe.id}
                                ingredients={recipe.ingredients}
                                instructions={recipe.instructions}
                                servings={recipe.servings}
                                icons={{ cart: icons.cart }}
                            />
                        </div>
                    </div>
                    <div className={styles.main}>
                        <StepsList
                            recipeId={recipe.id}
                            recipeTitle={recipe.title}
                            instructions={recipe.instructions}
                            icons={{ timer: icons.timer, check: icons.check }}
                        />
                        {recipe.notes && (
                            <section className={styles.notes} aria-labelledby={`notes-${recipe.id}`}>
                                <h2 id={`notes-${recipe.id}`} className={styles.sectionTitle}>
                                    Notes
                                </h2>
                                <p>{recipe.notes}</p>
                            </section>
                        )}
                        {recipe.sourceUrl && (
                            <footer className={styles.footer}>
                                <Button
                                    variant="outlined"
                                    size="s"
                                    trailingIcon={<Icon name="open_in_new" />}
                                    render={<a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" />}
                                    nativeButton={false}
                                >
                                    {source ? `Original on ${source}` : 'Original recipe'}
                                </Button>
                            </footer>
                        )}
                    </div>
                </article>
            </div>
        </PageTransition>
    )
}
