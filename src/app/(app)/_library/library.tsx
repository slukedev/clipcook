'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ChipSet, FilterChip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { Glyph } from '@/components/ui/icon/glyph'
import { IconButton } from '@/components/ui/icon-button'
import { Kbd } from '@/components/ui/kbd'
import {
    Menu,
    MenuCheckboxItem,
    MenuContent,
    MenuItem,
    MenuRadioGroup,
    MenuRadioItem,
    MenuSeparator,
    MenuTrigger,
} from '@/components/ui/menu'
import { SearchBar } from '@/components/ui/search'
import { PageTransition } from '@/components/ui/view-transition'
import { writeCookie } from '../_shell/preferences'
import { useSessionUser } from '../_shell/session-context'
import type { RecipeSummary, TagCount } from '@/lib/domain/types'
import type { CollectionRef } from './collection-dialog'
import type { LibraryIcons } from './icons'
import { JumpBackIn } from './jump-back-in'
import {
    LIBRARY_COOKIE,
    type LibraryPrefs,
    matches,
    queryTokens,
    SORTS,
    type SortKey,
    searchable,
    serializeLibraryPrefs,
    sortRecipes,
} from './library-data'
import { RecipeBrowser } from './recipe-browser'
import { useLibraryRecipes } from './use-library-recipes'
import styles from './library.module.scss'

interface LibraryProps {
    recipes: RecipeSummary[]
    collections: CollectionRef[]
    tags: TagCount[]
    prefs: LibraryPrefs
    icons: LibraryIcons
}

/** 'all', 'fav', or 'c:<collection id>'. */
type Scope = string

function isTyping(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null
    return Boolean(el?.closest('input, textarea, select, [contenteditable="true"]'))
}

const plural = (n: number) => (n === 1 ? '1 recipe' : `${n} recipes`)

export function Library({ recipes: serverRecipes, collections, tags, prefs: initialPrefs, icons }: LibraryProps) {
    const params = useSearchParams()
    const user = useSessionUser()
    const { recipes, toggleFavorite } = useLibraryRecipes(serverRecipes)
    const [query, setQuery] = useState(() => params.get('q') ?? '')
    const [scope, setScope] = useState<Scope>(() => params.get('f') ?? 'all')
    const [activeTags, setActiveTags] = useState<string[]>(() => params.getAll('tag'))
    const [prefs, setPrefs] = useState(initialPrefs)
    const searchRef = useRef<HTMLDivElement>(null)

    const deferredQuery = useDeferredValue(query)
    const tokens = queryTokens(deferredQuery)
    const validScope =
        scope === 'all' || scope === 'fav' || collections.some((c) => `c:${c.id}` === scope) ? scope : 'all'
    const filtering = tokens.length > 0 || validScope !== 'all' || activeTags.length > 0

    const filtered = searchable(recipes).filter((r) => {
        if (validScope === 'fav' && !r.favorite) return false
        if (validScope.startsWith('c:') && !r.collectionIds.includes(validScope.slice(2))) return false
        if (activeTags.length > 0 && !activeTags.every((t) => r.tags.includes(t))) return false
        return matches(r, tokens)
    })
    const visible = sortRecipes(filtered, prefs.sort)

    // Filters live in the URL so Back from a recipe returns to the same view.
    useEffect(() => {
        const url = new URL(window.location.href)
        url.searchParams.delete('q')
        url.searchParams.delete('f')
        url.searchParams.delete('tag')
        if (deferredQuery.trim()) url.searchParams.set('q', deferredQuery.trim())
        if (validScope !== 'all') url.searchParams.set('f', validScope)
        for (const tag of activeTags) url.searchParams.append('tag', tag)
        if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url)
    }, [deferredQuery, validScope, activeTags])

    // "/" jumps to search, as in Gmail and Drive.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
            const input = searchRef.current?.querySelector('input')
            if (!input) return
            event.preventDefault()
            input.focus()
            input.select()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    const updatePrefs = (next: Partial<LibraryPrefs>) => {
        const merged = { ...prefs, ...next }
        setPrefs(merged)
        writeCookie(LIBRARY_COOKIE, serializeLibraryPrefs(merged))
    }

    const clearFilters = () => {
        setQuery('')
        setScope('all')
        setActiveTags([])
    }

    const toggleTag = (tag: string, on: boolean) =>
        setActiveTags((current) => (on ? [...current, tag] : current.filter((t) => t !== tag)))

    const sortLabel = SORTS.find((s) => s.value === prefs.sort)?.label ?? 'Recent'
    const tagLabel =
        activeTags.length === 0
            ? 'Tags'
            : activeTags.length === 1
              ? activeTags[0]
              : `${activeTags[0]} +${activeTags.length - 1}`
    const cooked = filtering ? [] : recipes.filter((r) => r.lastCookedAt)

    const viewToggle = (
        <IconButton
            label={prefs.view === 'grid' ? 'Show as list' : 'Show as grid'}
            icon={prefs.view === 'grid' ? icons.list : icons.grid}
            onClick={() => updatePrefs({ view: prefs.view === 'grid' ? 'list' : 'grid' })}
        />
    )

    const sortMenu = (
        <Menu>
            <MenuTrigger
                render={
                    <Button variant="text" icon={icons.sort} aria-label={`Sort: ${sortLabel}`}>
                        {sortLabel}
                    </Button>
                }
            />
            <MenuContent align="end">
                <MenuRadioGroup value={prefs.sort} onValueChange={(value) => updatePrefs({ sort: value as SortKey })}>
                    {SORTS.map((s) => (
                        <MenuRadioItem key={s.value} value={s.value}>
                            {s.label}
                        </MenuRadioItem>
                    ))}
                </MenuRadioGroup>
            </MenuContent>
        </Menu>
    )

    if (recipes.length === 0) {
        return (
            <PageTransition>
                <div className={styles.page}>
                    <h1 className={styles.srOnly}>Library</h1>
                    <EmptyState
                        className={styles.empty}
                        shape="cookie9"
                        icon={icons.book}
                        title="No recipes yet"
                        titleAs="h2"
                        action={
                            <div className={styles.emptyActions}>
                                <Button
                                    size="m"
                                    icon={icons.link}
                                    render={<Link href="/clip?mode=link" />}
                                    nativeButton={false}
                                >
                                    Clip a recipe
                                </Button>
                                <div className={styles.secondaryActions}>
                                    <Button
                                        variant="text"
                                        icon={icons.paste}
                                        render={<Link href="/clip?mode=text" />}
                                        nativeButton={false}
                                    >
                                        Paste text
                                    </Button>
                                    <Button
                                        variant="text"
                                        icon={icons.edit}
                                        render={<Link href="/new" />}
                                        nativeButton={false}
                                    >
                                        Write one
                                    </Button>
                                </div>
                            </div>
                        }
                    />
                </div>
            </PageTransition>
        )
    }

    return (
        <PageTransition>
            <div className={styles.page}>
                <h1 className={styles.srOnly}>Library</h1>
                <header className={styles.header}>
                    <div className={styles.searchRow}>
                        <div ref={searchRef} className={styles.search}>
                            <SearchBar
                                value={query}
                                onValueChange={setQuery}
                                placeholder="Search recipes"
                                trailing={
                                    <>
                                        <Kbd className={styles.slash} aria-hidden>
                                            /
                                        </Kbd>
                                        <Link href="/settings#account" className={styles.account} aria-label="Account">
                                            <Avatar name={user.name ?? 'Cook'} src={user.picture} size={32} />
                                        </Link>
                                    </>
                                }
                            />
                        </div>
                        <div className={styles.wideTools}>
                            {sortMenu}
                            {viewToggle}
                        </div>
                    </div>
                    <ChipSet scroll label="Filter recipes" className={styles.chips}>
                        <FilterChip selected={validScope === 'all'} onSelectedChange={() => setScope('all')}>
                            All
                        </FilterChip>
                        <FilterChip
                            selected={validScope === 'fav'}
                            onSelectedChange={(on) => setScope(on ? 'fav' : 'all')}
                        >
                            Favorites
                        </FilterChip>
                        {collections.map((c) => (
                            <FilterChip
                                key={c.id}
                                selected={validScope === `c:${c.id}`}
                                onSelectedChange={(on) => setScope(on ? `c:${c.id}` : 'all')}
                            >
                                {c.name}
                            </FilterChip>
                        ))}
                        {tags.length > 0 && (
                            <Menu>
                                <MenuTrigger
                                    render={
                                        <FilterChip
                                            selected={activeTags.length > 0}
                                            trailing={<Glyph name="arrow_drop_down" />}
                                            aria-label={
                                                activeTags.length > 0 ? `Tags: ${activeTags.join(', ')}` : 'Tags'
                                            }
                                        >
                                            {tagLabel}
                                        </FilterChip>
                                    }
                                />
                                <MenuContent align="end">
                                    {activeTags.length > 0 && (
                                        <>
                                            <MenuItem onClick={() => setActiveTags([])}>Clear tags</MenuItem>
                                            <MenuSeparator />
                                        </>
                                    )}
                                    {tags.map(({ tag }) => (
                                        <MenuCheckboxItem
                                            key={tag}
                                            checked={activeTags.includes(tag)}
                                            onCheckedChange={(on) => toggleTag(tag, on)}
                                        >
                                            {tag}
                                        </MenuCheckboxItem>
                                    ))}
                                </MenuContent>
                            </Menu>
                        )}
                    </ChipSet>
                    <div className={styles.toolRow}>
                        <p className={styles.count} aria-live="polite">
                            {filtering ? plural(visible.length) : ''}
                        </p>
                        <div className={styles.compactTools}>
                            {sortMenu}
                            {viewToggle}
                        </div>
                    </div>
                </header>

                {cooked.length > 0 && <JumpBackIn recipes={cooked} />}

                {visible.length > 0 ? (
                    <section aria-labelledby="library-all" className={styles.section}>
                        <h2 id="library-all" className={cooked.length > 0 ? styles.sectionTitle : styles.srOnly}>
                            {filtering ? 'Results' : 'All recipes'}
                        </h2>
                        <RecipeBrowser
                            recipes={visible}
                            view={prefs.view}
                            tokens={tokens}
                            icons={icons}
                            collections={collections}
                            onFavorite={toggleFavorite}
                            label="Recipes"
                        />
                    </section>
                ) : (
                    <EmptyState
                        className={styles.empty}
                        shape="clover4"
                        icon={icons.searchOff}
                        title="No matches"
                        titleAs="h2"
                        action={
                            <Button variant="tonal" onClick={clearFilters}>
                                Clear filters
                            </Button>
                        }
                    />
                )}
            </div>
        </PageTransition>
    )
}
