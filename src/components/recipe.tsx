'use client'

import Link from 'next/link'
import styles from '@/styles/Components.module.scss'
import { Ripple } from './ripple'

interface RecipeProps {
    id: string
    image: string
    title: string
    boldindexes?: number[]
}

export function Recipe({ id, image, title, boldindexes }: RecipeProps) {
    const indexes = boldindexes ?? []
    return (
        <Ripple speedms={500} feather="20px" style={{ borderRadius: 12 }} className={styles.recipeContainer}>
            <Link style={{ width: 'fit-content', display: 'block' }} href={`/recipe/${id}`} passHref>
                <div className={styles.recipe}>
                    <div className={styles.recipeImage} style={{ backgroundImage: `url("${image}")` }} />
                    <div className={styles.recipeContent}>
                        <h2 className={styles.recipeTitle}>
                            {title.split('').map((char, index) =>
                                indexes.includes(index) ? (
                                    <b
                                        style={{ color: 'var(--md-sys-color-primary)' }}
                                        // biome-ignore lint/suspicious/noArrayIndexKey: character positions in a fixed title are the stable identity
                                        key={index}
                                    >
                                        {char}
                                    </b>
                                ) : (
                                    char
                                ),
                            )}
                        </h2>
                    </div>
                </div>
            </Link>
        </Ripple>
    )
}
