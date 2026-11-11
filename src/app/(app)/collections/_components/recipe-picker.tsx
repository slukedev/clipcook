'use client'

import { type ReactNode, useDeferredValue, useState, useTransition } from 'react'
import { addToCollection, removeFromCollection } from '@/actions/collections'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { SearchBar } from '@/components/ui/search'
import { useSnackbar } from '@/components/ui/snackbar'
import type { RecipeSummary } from '@/lib/domain/types'
import type { CollectionRef } from '../../_library/collection-dialog'
import { matches, queryTokens, searchable } from '../../_library/library-data'
import { RecipeMedia } from '../../_library/recipe-media'
import styles from './recipe-picker.module.scss'

export interface PickerTarget {
    key: number
}

interface RecipePickerProps {
    target: PickerTarget | null
    onClose: () => void
    collection: CollectionRef
    recipes: RecipeSummary[]
    searchIcon: ReactNode
}

/** Check recipes in or out of a collection, with search over the whole library. */
export function RecipePicker({ target, onClose, collection, recipes, searchIcon }: RecipePickerProps) {
    const [shown, setShown] = useState(target)
    if (target && target !== shown) setShown(target)
    return (
        <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
            {shown && (
                <Picker
                    key={shown.key}
                    collection={collection}
                    recipes={recipes}
                    onClose={onClose}
                    searchIcon={searchIcon}
                />
            )}
        </Dialog>
    )
}

function Picker({ collection, recipes, onClose, searchIcon }: Omit<RecipePickerProps, 'target'>) {
    const snackbar = useSnackbar()
    const [initial] = useState(
        () => new Set(recipes.filter((r) => r.collectionIds.includes(collection.id)).map((r) => r.id)),
    )
    const [checked, setChecked] = useState<ReadonlySet<string>>(initial)
    const [query, setQuery] = useState('')
    const [pending, startTransition] = useTransition()
    const tokens = queryTokens(useDeferredValue(query))
    // Members first, then the rest, each alphabetical, so the current state reads at a glance.
    const ordered = searchable(recipes)
        .filter((r) => matches(r, tokens))
        .toSorted(
            (a, b) =>
                Number(initial.has(b.id)) - Number(initial.has(a.id)) ||
                a.title.localeCompare(b.title, undefined, { numeric: true }),
        )

    const added = [...checked].filter((id) => !initial.has(id))
    const removed = [...initial].filter((id) => !checked.has(id))
    const dirty = added.length > 0 || removed.length > 0

    const toggle = (id: string, on: boolean) => {
        const next = new Set(checked)
        if (on) next.add(id)
        else next.delete(id)
        setChecked(next)
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
            {ordered.length === 0 ? (
                <p className={styles.none}>No matches</p>
            ) : (
                <ul className={styles.list} aria-label="Recipes">
                    {ordered.map((recipe) => (
                        <li key={recipe.id} className={styles.item}>
                            <Checkbox
                                className={styles.row}
                                checked={checked.has(recipe.id)}
                                onCheckedChange={(on) => toggle(recipe.id, on)}
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
                    ))}
                </ul>
            )}
        </DialogContent>
    )
}
