'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import styles from '@/styles/Home.module.scss'
import { Icon } from '@/components/icon'
import { Input } from '@/components/input'
import { Main } from '@/components/main'
import { Recipe } from '@/components/recipe'
import { Ripple } from '@/components/ripple'
import { useSessionUser } from './session-context'

interface RecipeItem {
    id: string
    title: string
    image: string
}

export function HomeClient({ recipes }: { recipes: RecipeItem[] }) {
    const user = useSessionUser()
    const [search, setSearch] = useState('')

    const filtered = useMemo(() => {
        if (search.length === 0) return recipes.map((r) => ({ ...r, boldIndexes: [] as number[] }))
        const needle = search.toLowerCase()
        const results: (RecipeItem & { boldIndexes: number[] })[] = []
        for (const recipe of recipes) {
            const title = recipe.title.toLowerCase()
            const boldIndexes: number[] = []
            let ok = true
            for (const ch of needle) {
                const idx = title.indexOf(ch)
                if (idx === -1) {
                    ok = false
                    break
                }
                boldIndexes.push(idx)
            }
            if (ok) results.push({ ...recipe, boldIndexes })
        }
        return results
    }, [recipes, search])

    return (
        <>
            <Main pageName="index">
                <h1>Welcome, {user.name ?? 'there'}!</h1>
                <Input
                    onChange={(e) => setSearch(e.currentTarget.value)}
                    label="Search"
                    name="search"
                    type="text"
                    icon="search"
                    value={search}
                />
                <div className={styles.recipes}>
                    {filtered.length === 0 ? (
                        <motion.div
                            key="error"
                            initial={{ scale: 0.92, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ ease: 'easeInOut', duration: 0.3 }}
                            exit={{ opacity: 0 }}
                            className={styles.couldntFind}
                        >
                            <Icon name="sound_detection_dog_barking" iconsize="128" />
                            <h1>Sorry, we couldn&apos;t find anything that matches</h1>
                            <p>
                                We put our best searcher out and she came back with crumbs on her face, but no food to
                                be found
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            style={{ overflowX: 'hidden' }}
                            key="recipes"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ ease: 'easeInOut', duration: 0.3 }}
                            exit={{ opacity: 0 }}
                        >
                            {filtered.map((recipe) => (
                                <Recipe
                                    key={recipe.id}
                                    id={recipe.id}
                                    title={recipe.title}
                                    image={recipe.image}
                                    boldindexes={recipe.boldIndexes}
                                />
                            ))}
                        </motion.div>
                    )}
                </div>
            </Main>

            <Link href="/create" passHref>
                <div className={styles.fab}>
                    <Ripple feather="5px" speedms={500}>
                        <button type="button">
                            <Icon name="add" iconsize="24" />
                        </button>
                    </Ripple>
                </div>
            </Link>
        </>
    )
}
