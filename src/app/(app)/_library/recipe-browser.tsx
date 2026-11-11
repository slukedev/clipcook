'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react'
import { addToCollection, removeFromCollection } from '@/actions/collections'
import { duplicateRecipe } from '@/actions/recipes'
import { useSnackbar } from '@/components/ui/snackbar'
import { Toolbar, ToolbarButton } from '@/components/ui/toolbar'
import type { RecipeSummary } from '@/lib/domain/types'
import { CollectionDialog, type CollectionRef, type CollectionTarget } from './collection-dialog'
import type { LibraryIcons } from './icons'
import type { ViewMode } from './library-data'
import { scheduleDelete, UNDO_WINDOW } from './pending-deletes'
import { type CardAction, RecipeCard } from './recipe-card'
import styles from './recipe-browser.module.scss'

export interface RecipeBrowserProps {
    recipes: RecipeSummary[]
    view: ViewMode
    /** Search tokens to highlight in titles. */
    tokens: string[]
    icons: LibraryIcons
    collections: CollectionRef[]
    onFavorite: (id: string, value: boolean) => void
    /** Inside a collection: adds "Remove from collection". */
    collection?: CollectionRef
    /** Accessible name for the grid. */
    label: string
}

const deletedMessage = (n: number) => (n === 1 ? 'Recipe deleted' : `${n} recipes deleted`)

/**
 * The recipe grid (or list) shared by the library and collections, with the card
 * actions, multi-select and its floating toolbar.
 */
export function RecipeBrowser({
    recipes,
    view,
    tokens,
    icons,
    collections,
    onFavorite,
    collection,
    label,
}: RecipeBrowserProps) {
    const router = useRouter()
    const snackbar = useSnackbar()
    const [, startTransition] = useTransition()
    const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
    const [selecting, setSelecting] = useState(false)
    const anchor = useRef<string | null>(null)
    const [target, setTarget] = useState<CollectionTarget | null>(null)
    const [removed, hideRemoved] = useOptimistic(
        new Set<string>(),
        (state, ids: string[]) => new Set([...state, ...ids]),
    )

    const shown = removed.size > 0 ? recipes.filter((r) => !removed.has(r.id)) : recipes
    const visibleSelected = shown.filter((r) => selected.has(r.id))

    const exitSelection = () => {
        setSelecting(false)
        setSelected(new Set())
        anchor.current = null
    }

    useEffect(() => {
        if (!selecting) return
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') exitSelection()
            if (event.key === 'a' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                setSelected(new Set(shown.map((r) => r.id)))
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    })

    const toggleSelect = (id: string, range: boolean) => {
        const next = new Set(selected)
        const from = anchor.current ? shown.findIndex((r) => r.id === anchor.current) : -1
        const to = shown.findIndex((r) => r.id === id)
        if (range && from !== -1 && to !== -1) {
            const [a, b] = from < to ? [from, to] : [to, from]
            for (const r of shown.slice(a, b + 1)) next.add(r.id)
        } else if (next.has(id)) {
            next.delete(id)
        } else {
            next.add(id)
        }
        anchor.current = id
        setSelected(next)
        setSelecting(next.size > 0)
    }

    const remove = (ids: string[]) => {
        const undo = scheduleDelete(ids, (error, retry) =>
            snackbar({ message: error, action: 'Retry', onAction: retry, urgent: true }),
        )
        snackbar({
            message: deletedMessage(ids.length),
            action: 'Undo',
            duration: UNDO_WINDOW,
            onAction: () => {
                if (!undo()) snackbar('Already deleted')
            },
        })
    }

    const removeFrom = (ids: string[]) => {
        if (!collection) return
        startTransition(async () => {
            hideRemoved(ids)
            const result = await removeFromCollection(collection.id, ids)
            if (!result.ok) {
                snackbar({ message: result.error, urgent: true })
                return
            }
            snackbar({
                message: `Removed from ${collection.name}`,
                action: 'Undo',
                onAction: () => {
                    startTransition(async () => {
                        const back = await addToCollection(collection.id, ids)
                        if (!back.ok) snackbar({ message: back.error, urgent: true })
                    })
                },
            })
        })
    }

    const duplicate = (id: string) => {
        startTransition(async () => {
            const result = await duplicateRecipe(id)
            if (!result.ok) {
                snackbar({ message: result.error, urgent: true })
                return
            }
            snackbar({ message: 'Duplicated', action: 'Open', onAction: () => router.push(`/recipe/${result.data}`) })
        })
    }

    const fileInto = (list: RecipeSummary[]) => setTarget({ key: Date.now(), recipes: list })

    const onAction = (action: CardAction, id: string) => {
        const recipe = shown.find((r) => r.id === id)
        if (!recipe) return
        if (action === 'collections') fileInto([recipe])
        else if (action === 'duplicate') duplicate(id)
        else if (action === 'select') toggleSelect(id, false)
        else if (action === 'remove') removeFrom([id])
        else if (action === 'delete') remove([id])
    }

    const actions: CardAction[] = collection
        ? ['collections', 'remove', 'duplicate', 'select', 'delete']
        : ['collections', 'duplicate', 'select', 'delete']

    return (
        <>
            <ul className={styles.items} data-view={view} aria-label={label} data-selecting={selecting || undefined}>
                {shown.map((recipe, index) => (
                    <li key={recipe.id}>
                        <RecipeCard
                            recipe={recipe}
                            view={view}
                            tokens={tokens}
                            icons={icons}
                            actions={actions}
                            selecting={selecting}
                            selected={selected.has(recipe.id)}
                            priority={index < 6}
                            onFavorite={onFavorite}
                            onToggleSelect={toggleSelect}
                            onAction={onAction}
                        />
                    </li>
                ))}
            </ul>
            {selecting && (
                <div className={styles.selectionBar}>
                    <Toolbar label="Selection" color="vibrant">
                        <ToolbarButton label="Done" icon={icons.close} onClick={exitSelection} />
                        <output className={styles.count} aria-live="polite">
                            {visibleSelected.length} selected
                        </output>
                        <ToolbarButton
                            label="Select all"
                            icon={icons.selectAll}
                            onClick={() => setSelected(new Set(shown.map((r) => r.id)))}
                        />
                        <ToolbarButton
                            label="Add to collection"
                            icon={icons.collection}
                            disabled={visibleSelected.length === 0}
                            onClick={() => fileInto(visibleSelected)}
                        />
                        {collection && (
                            <ToolbarButton
                                label="Remove from collection"
                                icon={icons.remove}
                                disabled={visibleSelected.length === 0}
                                onClick={() => {
                                    removeFrom(visibleSelected.map((r) => r.id))
                                    exitSelection()
                                }}
                            />
                        )}
                        <ToolbarButton
                            label="Delete"
                            icon={icons.delete}
                            disabled={visibleSelected.length === 0}
                            onClick={() => {
                                remove(visibleSelected.map((r) => r.id))
                                exitSelection()
                            }}
                        />
                    </Toolbar>
                </div>
            )}
            <CollectionDialog
                target={target}
                onClose={() => setTarget(null)}
                collections={collections}
                onDone={selecting ? exitSelection : undefined}
            />
        </>
    )
}
