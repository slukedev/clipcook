'use client'

import { Carousel } from '@/components/ui/carousel'
import { TransitionLink } from '@/components/ui/view-transition'
import type { RecipeSummary } from '@/lib/domain/types'
import styles from './jump-back-in.module.scss'
import { RecipeMedia } from './recipe-media'

const MAX_ITEMS = 10
/** Enough to fill the first view at every width, so returning to the library never paints them empty. */
const EAGER_ITEMS = 6

/** Recently cooked recipes, most recent first, in a multi-browse carousel. */
export function JumpBackIn({ recipes }: { recipes: RecipeSummary[] }) {
    const recent = recipes.toSorted((a, b) => (b.lastCookedAt ?? 0) - (a.lastCookedAt ?? 0)).slice(0, MAX_ITEMS)
    return (
        <section className={styles.section} aria-labelledby="jump-back-in">
            <h2 id="jump-back-in" className={styles.title}>
                Jump Back In
            </h2>
            <Carousel label="Jump back in" className={styles.carousel}>
                {recent.map((recipe, index) => (
                    <TransitionLink key={recipe.id} href={`/recipe/${recipe.id}`} className={styles.item} prefetch>
                        <RecipeMedia
                            src={recipe.thumbnail}
                            title={recipe.title}
                            sizes="(width < 840px) 40vw, 360px"
                            priority={index < EAGER_ITEMS}
                        />
                        <span className={styles.label}>{recipe.title}</span>
                    </TransitionLink>
                ))}
            </Carousel>
        </section>
    )
}
