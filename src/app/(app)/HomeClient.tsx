'use client'

import { useMemo, useState } from 'react'
import { Button, Card, EmptyState, Fab, Icon, SearchBar } from '@/components/ui'
import { seedToHex } from '@/lib/theme/seed'
import { useSessionUser } from './session-context'
import styles from './home.module.scss'

interface RecipeItem {
    id: string
    title: string
    thumbnail: string
    seedColor: number | null
}

interface Match extends RecipeItem {
    /** [start, end) of a substring match in title, for highlighting. */
    range: [number, number] | null
}

/** Substring matches first (highlighted), then subsequence matches. */
function searchRecipes(recipes: RecipeItem[], query: string): Match[] {
    const needle = query.trim().toLowerCase()
    if (!needle) return recipes.map((r) => ({ ...r, range: null }))

    const substring: Match[] = []
    const subsequence: Match[] = []
    for (const recipe of recipes) {
        const title = recipe.title.toLowerCase()
        const index = title.indexOf(needle)
        if (index !== -1) {
            substring.push({ ...recipe, range: [index, index + needle.length] })
            continue
        }
        let cursor = 0
        let ok = true
        for (const ch of needle) {
            if (ch === ' ') continue
            cursor = title.indexOf(ch, cursor)
            if (cursor === -1) {
                ok = false
                break
            }
            cursor += 1
        }
        if (ok) subsequence.push({ ...recipe, range: null })
    }
    return [...substring, ...subsequence]
}

function Highlighted({ title, range }: { title: string; range: [number, number] | null }) {
    if (!range) return title
    return (
        <>
            {title.slice(0, range[0])}
            <mark className={styles.mark}>{title.slice(range[0], range[1])}</mark>
            {title.slice(range[1])}
        </>
    )
}

function firstNameOf(name: string | null | undefined): string | null {
    const first = name?.trim().split(/\s+/)[0]
    return first || null
}

export function HomeClient({ recipes }: { recipes: RecipeItem[] }) {
    const user = useSessionUser()
    const [search, setSearch] = useState('')
    const results = useMemo(() => searchRecipes(recipes, search), [recipes, search])
    const firstName = firstNameOf(user.name)

    return (
        <>
            <main className={styles.main}>
                <header className={styles.header}>
                    <div className={styles.headlineGroup}>
                        <h1 className={styles.headline}>{firstName ? `${firstName}’s recipes` : 'Your recipes'}</h1>
                        <p className={styles.count}>
                            {recipes.length === 0
                                ? 'Nothing saved yet'
                                : `${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'} saved`}
                        </p>
                    </div>
                    {recipes.length > 0 && (
                        <SearchBar
                            value={search}
                            onChange={setSearch}
                            placeholder="Search your recipes"
                            className={styles.search}
                        />
                    )}
                </header>

                {recipes.length === 0 ? (
                    <EmptyState
                        icon="skillet"
                        headline="Your cookbook is empty"
                        body="Clip a recipe from any site with a single link, or write one from scratch. Belle promises not to eat it."
                    >
                        <Button icon="add" href="/create">
                            New recipe
                        </Button>
                    </EmptyState>
                ) : results.length === 0 ? (
                    <EmptyState
                        icon="search_off"
                        headline="Nothing matches"
                        body="We sent our best searcher out. She came back with crumbs on her face, but no food to be found."
                    >
                        <Button variant="tonal" onClick={() => setSearch('')}>
                            Clear search
                        </Button>
                    </EmptyState>
                ) : (
                    <ul className={styles.grid}>
                        {results.map((recipe) => (
                            <li key={recipe.id}>
                                <Card
                                    variant="filled"
                                    href={`/recipe/${recipe.id}`}
                                    className={styles.card}
                                    aria-label={recipe.title}
                                >
                                    <div
                                        className={styles.thumb}
                                        style={
                                            recipe.seedColor !== null
                                                ? { backgroundColor: seedToHex(recipe.seedColor) }
                                                : undefined
                                        }
                                    >
                                        {recipe.thumbnail ? (
                                            // Thumbnails are tiny (data URLs or token URLs); plain img
                                            // keeps legacy and Storage recipes on one code path.
                                            // biome-ignore lint/performance/noImgElement: legacy thumbs are data URLs next/image cannot optimize
                                            <img src={recipe.thumbnail} alt="" loading="lazy" decoding="async" />
                                        ) : (
                                            <Icon name="restaurant" size={36} className={styles.thumbIcon} />
                                        )}
                                    </div>
                                    <h2 className={styles.cardTitle}>
                                        <Highlighted title={recipe.title} range={recipe.range} />
                                    </h2>
                                </Card>
                            </li>
                        ))}
                    </ul>
                )}
            </main>

            <Fab icon="add" label="New recipe" className={styles.fab} href="/create" />
        </>
    )
}
