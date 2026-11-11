'use client'

import { type ReactNode, Suspense, use, useDeferredValue, useState, useTransition } from 'react'
import { addToCollection, removeFromCollection } from '@/actions/collections'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { LoadingIndicator } from '@/components/ui/loading-indicator'
import { SearchBar } from '@/components/ui/search'
import { useSnackbar } from '@/components/ui/snackbar'
import type { ActionResult, RecipeSummary } from '@/lib/domain/types'
import type { CollectionRef } from '../../_library/collection-dialog'
import { matches, queryTokens, searchable } from '../../_library/library-data'
import { RecipeMedia } from '../../_library/recipe-media'
import styles from './recipe-picker.module.scss'

export interface PickerTarget {
    key: number
    /** Started when the picker opens, so the library arrives while the dialog animates in. */
    recipes: Promise<ActionResult<RecipeSummary[]>>
}

interface RecipePickerProps {
    target: PickerTarget | null
    onClose: () => void
    collection: CollectionRef
    searchIcon: ReactNode
}

/** Check recipes in or out of a collection, with search over the whole library. */
export function RecipePicker({ target, onClose, collection, searchIcon }: RecipePickerProps) {
    const [shown, setShown] = useState(target)
    if (target && target !== shown) setShown(target)
    return (
        <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
            {shown && (
                <Picker
                    key={shown.key}
                    collection={collection}
                    recipes={shown.recipes}
                    onClose={onClose}
                    searchIcon={searchIcon}
                />
            )}
        </Dialog>
    )
}

interface PickerProps {
    collection: CollectionRef
    recipes: PickerTarget['recipes']
    onClose: () => void
    searchIcon: ReactNode
}

function Picker({ collection, recipes, onClose, searchIcon }: PickerProps) {
    const snackbar = useSnackbar()
    /** Recipe id to wanted membership, only where it differs from the saved state. */
    const [changes, setChanges] = useState<ReadonlyMap<string, boolean>>(new Map())
    const [query, setQuery] = useState('')
    const [pending, startTransition] = useTransition()
    const added = [...changes].filter(([, on]) => on).map(([id]) => id)
    const removed = [...changes].filter(([, on]) => !on).map(([id]) => id)
    const dirty = changes.size > 0

    const toggle = (id: string, on: boolean, member: boolean) => {
        const next = new Map(changes)
        if (on === member) next.delete(id)
        else next.set(id, on)
        setChanges(next)
    }

    const save = () => {
        if (!dirty) return onClose()
        startTransition(async () => {
            const results = await Promise.all([
                added.length > 0 ? addToCollection(collection.id, added) : null,
                removed.length > 0 ? removeFromCollection(collection.id, removed) : null,
            ])
            const failed = results.find((r) => r && !r.ok)
            if (failed && !failed.ok) {
                snackbar({ message: failed.error, urgent: true })
                return
            }
            onClose()
            if (added.length > 0 && removed.length === 0) {
                snackbar(added.length === 1 ? 'Added 1 recipe' : `Added ${added.length} recipes`)
            } else {
                snackbar('Collection updated')
            }
        })
    }

    const saveButton = (
        <Button variant="text" onClick={save} loading={pending}>
            Save
        </Button>
    )

    return (
        <DialogContent
            className={styles.dialog}
            headline={`Add to ${collection.name}`}
            fullScreen
            fullScreenAction={saveButton}
            actions={
                <>
                    <DialogClose render={<Button variant="text" />}>Cancel</DialogClose>
                    {saveButton}
                </>
            }
        >
            <div className={styles.search}>
                <SearchBar value={query} onValueChange={setQuery} placeholder="Search recipes" leading={searchIcon} />
            </div>
            <Suspense
                fallback={
                    <div className={styles.loading}>
                        <LoadingIndicator label="Loading recipes" />
                    </div>
                }
            >
                <PickerList
                    collectionId={collection.id}
                    recipes={recipes}
                    query={query}
                    changes={changes}
                    onToggle={toggle}
                />
            </Suspense>
        </DialogContent>
    )
}

interface PickerListProps {
    collectionId: string
    recipes: PickerTarget['recipes']
    query: string
    changes: ReadonlyMap<string, boolean>
    onToggle: (id: string, on: boolean, member: boolean) => void
}

function PickerList({ collectionId, recipes, query, changes, onToggle }: PickerListProps) {
    const result = use(recipes)
    const tokens = queryTokens(useDeferredValue(query))
    if (!result.ok) return <p className={styles.none}>{result.error}</p>
    const isMember = (r: RecipeSummary) => r.collectionIds.includes(collectionId)
    // Members first, then the rest, each alphabetical, so the current state reads at a glance.
    const ordered = searchable(result.data)
        .filter((r) => matches(r, tokens))
        .toSorted(
            (a, b) =>
                Number(isMember(b)) - Number(isMember(a)) ||
                a.title.localeCompare(b.title, undefined, { numeric: true }),
        )
    if (ordered.length === 0) return <p className={styles.none}>No matches</p>
    return (
        <ul className={styles.list} aria-label="Recipes">
            {ordered.map((recipe) => {
                const member = isMember(recipe)
                return (
                    <li key={recipe.id} className={styles.item}>
                        <Checkbox
                            className={styles.row}
                            checked={changes.get(recipe.id) ?? member}
                            onCheckedChange={(on) => onToggle(recipe.id, on, member)}
                            label={
                                <>
                                    <span className={styles.thumb}>
                                        <RecipeMedia src={recipe.thumbnail} title={recipe.title} sizes="40px" />
                                    </span>
                                    <span className={styles.title}>{recipe.title}</span>
                                </>
                            }
                        />
                    </li>
                )
            })}
        </ul>
    )
}
