'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Ripple } from '@/components/ui/ripple'
import { recipeScale } from '@/lib/cook/recipe-state'
import type { PlanEntry, RecipeSummary } from '@/lib/domain/types'
import { entryScale, leadEntry, MEAL_LABELS } from '@/lib/plan/entries'
import { RecipeMedia } from '../../_library/recipe-media'
import type { PlanIcons } from './icons'
import { recipeTime, servingsLabel } from './plan-entry'
import styles from './tonight.module.scss'

export function TonightCard({
    today,
    hour,
    entries,
    recipes,
    suggestions,
    icons,
    onAdd,
    onBrowse,
}: {
    today: string
    hour: number
    entries: PlanEntry[]
    recipes: Record<string, RecipeSummary>
    suggestions: RecipeSummary[]
    icons: PlanIcons
    onAdd: (recipe: RecipeSummary) => void
    onBrowse: () => void
}) {
    const lead = leadEntry(entries, hour)
    const rest = entries.filter((e) => e !== lead)
    const leadRecipe = lead?.recipeId ? recipes[lead.recipeId] : undefined
    const heading = !lead || lead.meal === 'dinner' ? 'Tonight' : 'Today'
    const headingId = `tonight-${today}`

    if (!lead) {
        return (
            <section className={styles.card} data-empty="" aria-labelledby={headingId}>
                <h2 id={headingId} className={styles.emptyTitle}>
                    Nothing Planned Tonight
                </h2>
                {suggestions.length > 0 && (
                    <ul className={styles.suggestions} aria-label="Suggestions">
                        {suggestions.map((recipe) => (
                            <li key={recipe.id}>
                                <button
                                    type="button"
                                    className={styles.suggestion}
                                    onClick={() => onAdd(recipe)}
                                    aria-label={`Plan ${recipe.title} for tonight`}
                                >
                                    <Ripple />
                                    <span className={styles.suggestionThumb}>
                                        <RecipeMedia src={recipe.thumbnail} title={recipe.title} sizes="56px" />
                                    </span>
                                    <span className={styles.suggestionText}>
                                        <span className={styles.suggestionTitle}>{recipe.title}</span>
                                        {recipeTime(recipe) && (
                                            <span className={styles.suggestionMeta}>{recipeTime(recipe)}</span>
                                        )}
                                    </span>
                                    <span className={styles.suggestionAdd} aria-hidden>
                                        {icons.add}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <div className={styles.actions}>
                    <Button variant={suggestions.length > 0 ? 'text' : 'tonal'} icon={icons.search} onClick={onBrowse}>
                        Find a recipe
                    </Button>
                </div>
            </section>
        )
    }

    const meta = [
        lead.meal === 'dinner' || lead.meal === 'snack' ? '' : MEAL_LABELS[lead.meal],
        recipeTime(leadRecipe),
        servingsLabel(lead.servings),
    ].filter(Boolean)
    const title = leadRecipe ? leadRecipe.title : lead.note

    return (
        <section className={styles.card} data-photo={leadRecipe ? '' : undefined} aria-labelledby={headingId}>
            <div className={styles.lead}>
                <span className={styles.photo} data-note={leadRecipe ? undefined : ''}>
                    {leadRecipe ? (
                        <RecipeMedia
                            src={leadRecipe.thumbnail}
                            title={leadRecipe.title}
                            sizes="(width < 600px) 112px, (width < 840px) 160px, 720px"
                            priority
                        />
                    ) : (
                        <span className={styles.noteIcon}>{icons.note}</span>
                    )}
                </span>
                <div className={styles.leadText}>
                    <h2 id={headingId} className={styles.title}>
                        <span className={styles.srOnly}>{`${heading}: `}</span>
                        {leadRecipe ? <Link href={`/recipe/${leadRecipe.id}`}>{title}</Link> : title}
                    </h2>
                    <p className={styles.meta}>
                        <span className={styles.when}>{heading}</span>
                        {meta.map((part) => ` · ${part}`).join('')}
                    </p>
                    {leadRecipe && (
                        <div className={styles.leadActions}>
                            <CookButton entry={lead} recipe={leadRecipe} icon={icons.cook} />
                        </div>
                    )}
                </div>
            </div>
            {rest.length > 0 && (
                <ul className={styles.rest} aria-label={`Also ${heading.toLowerCase()}`}>
                    {rest.map((entry) => {
                        const recipe = entry.recipeId ? recipes[entry.recipeId] : undefined
                        const label = recipe ? recipe.title : entry.note
                        return (
                            <li key={entry.id} className={styles.restItem}>
                                <span className={styles.restMeal}>{MEAL_LABELS[entry.meal]}</span>
                                {recipe ? (
                                    <Link href={`/recipe/${recipe.id}`} className={styles.restTitle}>
                                        {label}
                                    </Link>
                                ) : (
                                    <span className={styles.restTitle}>{label}</span>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}
        </section>
    )
}

/** Straight into cook mode, at the planned servings. */
function CookButton({ entry, recipe, icon }: { entry: PlanEntry; recipe: RecipeSummary; icon: ReactNode }) {
    return (
        <Button
            size="m"
            icon={icon}
            render={
                <Link
                    href={`/recipe/${recipe.id}/cook`}
                    transitionTypes={['cook']}
                    prefetch
                    // Cook mode reads the servings scale the recipe page shares with it.
                    onClick={() => recipeScale.set(recipe.id, entryScale(entry, recipe.servings))}
                />
            }
            nativeButton={false}
        >
            Cook
        </Button>
    )
}
