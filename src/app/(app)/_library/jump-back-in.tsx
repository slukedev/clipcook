'use client'

import { Carousel } from '@/components/ui/carousel'
import { TransitionLink } from '@/components/ui/view-transition'
import type { RecipeSummary } from '@/lib/domain/types'
import { RecipeMedia } from './recipe-media'
import styles from './jump-back-in.module.scss'

const MAX_ITEMS = 10

/** Recently cooked recipes, most recent first, in a multi-browse carousel. */
export function JumpBackIn({ recipes }: { recipes: RecipeSummary[] }) {
    const recent = recipes.toSorted((a, b) => (b.lastCookedAt ?? 0) - (a.lastCookedAt ?? 0)).slice(0, MAX_ITEMS)
    return (
        <section className={styles.section} aria-labelledby="jump-back-in">
            <h2 id="jump-back-in" className={styles.title}>
                Jump back in
            </h2>
            <Carousel label="Jump back in" className={styles.carousel}>
                {recent.map((recipe) => (
                    <TransitionLink key={recipe.id} href={`/recipe/${recipe.id}`} className={styles.item}>
                        <RecipeMedia src={recipe.thumbnail} title={recipe.title} sizes="(width < 840px) 40vw, 360px" />
                        <span className={styles.label}>{recipe.title}</span>
                    </TransitionLink>
                ))}
            </Carousel>
        </section>
    )
}
