'use client'

import { type FormEvent, useState, useTransition } from 'react'
import { addToCollection, createCollection, removeFromCollection } from '@/actions/collections'
import { setRecipeCollections } from '@/actions/recipes'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { useSnackbar } from '@/components/ui/snackbar'
import { TextField } from '@/components/ui/text-field'
import { LIMITS, type RecipeSummary } from '@/lib/domain/types'
import styles from './collection-dialog.module.scss'

export interface CollectionRef {
    id: string
    name: string
}

export interface CollectionTarget {
    /** Changes on every open so the picker starts fresh. */
    key: number
    /** The recipes being filed, with their current collections. */
    recipes: Pick<RecipeSummary, 'id' | 'collectionIds'>[]
}

interface CollectionDialogProps {
    /** Open while set. */
    target: CollectionTarget | null
    onClose: () => void
    collections: CollectionRef[]
    onDone?: () => void
}

type Mark = boolean | 'mixed'

function initialMarks(recipes: CollectionTarget['recipes'], collections: CollectionRef[]) {
    const marks: Record<string, Mark> = {}
    for (const c of collections) {
        const count = recipes.filter((r) => r.collectionIds.includes(c.id)).length
        marks[c.id] = count === 0 ? false : count === recipes.length ? true : 'mixed'
    }
    return marks
}

/** Files one or many recipes into collections, with a quick way to make a new one. */
export function CollectionDialog({ target, onClose, collections, onDone }: CollectionDialogProps) {
    // Keeps the last target while the dialog animates closed.
    const [shown, setShown] = useState(target)
    if (target && target !== shown) setShown(target)
    return (
        <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
            {shown && (
                <Picker
                    key={shown.key}
                    recipes={shown.recipes}
                    collections={collections}
                    close={onClose}
                    onDone={onDone}
                />
            )}
        </Dialog>
    )
}

function Picker({
    recipes,
    collections,
    close,
    onDone,
}: {
    recipes: CollectionTarget['recipes']
    collections: CollectionRef[]
    close: () => void
    onDone?: () => void
}) {
    const snackbar = useSnackbar()
    const [list, setList] = useState(collections)
    const [start] = useState(() => initialMarks(recipes, collections))
    const [marks, setMarks] = useState(start)
    const [name, setName] = useState('')
    const [nameError, setNameError] = useState<string>()
    const [creating, startCreate] = useTransition()
    const [saving, startSave] = useTransition()
    const ids = recipes.map((r) => r.id)

    const create = (event: FormEvent) => {
        event.preventDefault()
        event.stopPropagation()
        const clean = name.trim()
        if (!clean) return
        startCreate(async () => {
            const result = await createCollection(clean)
            if (!result.ok) {
                setNameError(result.error)
                return
            }
            setList((current) => [...current, { id: result.data.id, name: result.data.name }])
            setMarks((current) => ({ ...current, [result.data.id]: true }))
            setName('')
            setNameError(undefined)
        })
    }

    const save = () => {
        startSave(async () => {
            let failed: string | null = null
            if (ids.length === 1 && ids[0]) {
                const chosen = list.filter((c) => marks[c.id] === true).map((c) => c.id)
                const result = await setRecipeCollections(ids[0], chosen)
                if (!result.ok) failed = result.error
            } else {
                const jobs: Promise<{ ok: boolean; error?: string }>[] = []
                for (const c of list) {
                    const mark = marks[c.id]
                    const was = start[c.id] ?? false
                    if (mark === was || mark === 'mixed') continue
                    if (mark === true) jobs.push(addToCollection(c.id, ids))
                    else jobs.push(removeFromCollection(c.id, ids))
                }
                const results = await Promise.all(jobs)
                failed = results.find((r) => !r.ok)?.error ?? null
            }
            if (failed) {
                snackbar({ message: failed, urgent: true })
                return
            }
            const added = list.filter((c) => marks[c.id] === true && start[c.id] !== true)
            const first = added[0]
            snackbar(added.length === 1 && first ? `Added to ${first.name}` : 'Collections saved')
            close()
            onDone?.()
        })
    }

    return (
        <DialogContent
            headline={recipes.length === 1 ? 'Add to Collection' : `Add ${recipes.length} Recipes to a Collection`}
            actions={
                <>
                    <DialogClose render={<Button variant="text" />}>Cancel</DialogClose>
                    <Button variant="text" onClick={save} loading={saving}>
                        Save
                    </Button>
                </>
            }
        >
            {list.length > 0 && (
                <ul className={styles.list} aria-label="Collections">
                    {list.map((c) => {
                        const mark = marks[c.id] ?? false
                        return (
                            <li key={c.id}>
                                <Checkbox
                                    className={styles.row}
                                    label={<span className={styles.name}>{c.name}</span>}
                                    checked={mark === true}
                                    indeterminate={mark === 'mixed'}
                                    onCheckedChange={(checked) =>
                                        setMarks((current) => ({ ...current, [c.id]: checked }))
                                    }
                                />
                            </li>
                        )
                    })}
                </ul>
            )}
            <form className={styles.create} onSubmit={create}>
                <TextField
                    className={styles.field}
                    label="New collection"
                    value={name}
                    onChange={(event) => {
                        setName(event.target.value)
                        setNameError(undefined)
                    }}
                    maxLength={LIMITS.collectionName}
                    error={nameError}
                    autoComplete="off"
                    enterKeyHint="done"
                />
                <Button type="submit" variant="tonal" loading={creating} disabled={!name.trim()}>
                    Create
                </Button>
            </form>
        </DialogContent>
    )
}
