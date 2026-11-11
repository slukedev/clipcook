'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { recipeScale } from '@/lib/cook/recipe-state'
import type { PlanEntry, RecipeSummary } from '@/lib/domain/types'
import { entryScale } from '@/lib/plan/entries'
import { formatMinutes } from '@/lib/recipe/time'
import { RecipeMedia } from './recipe-media'
import styles from './tonight.module.scss'

/** What the plan says is for dinner (or the next meal today), one tap from cook mode. */
export function Tonight({
    entry,
    recipe,
    label,
    cookIcon,
}: {
    entry: PlanEntry
    recipe: RecipeSummary
    /** 'Tonight', or 'Today' for a meal before dinner. */
    label: string
    cookIcon: ReactNode
}) {
    const time = recipe.totalMinutes ? formatMinutes(recipe.totalMinutes) : recipe.totalTime
    return (
        <section className={styles.tonight} aria-labelledby="library-tonight">
            <Link href="/plan" className={styles.link}>
                <span className={styles.photo}>
                    <RecipeMedia src={recipe.thumbnail} title={recipe.title} sizes="64px" priority />
                </span>
                <span className={styles.text}>
                    <span id="library-tonight" className={styles.title}>
                        <span className={styles.srOnly}>{`${label}: `}</span>
                        {recipe.title}
                    </span>
                    <span className={styles.meta}>
                        <span className={styles.when}>{label}</span>
                        {time && ` · ${time}`}
                    </span>
                </span>
            </Link>
            <Button
                className={styles.cook}
                icon={cookIcon}
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
                aria-label={`Cook ${recipe.title}`}
            >
                Cook
            </Button>
        </section>
    )
}
