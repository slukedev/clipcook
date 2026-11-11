'use client'

import { type FormEvent, type ReactNode, useState, useTransition } from 'react'
import { createCollection } from '@/actions/collections'
import { setRecipeCollections } from '@/actions/recipes'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { IconButton } from '@/components/ui/icon-button'
import { List, ListItem } from '@/components/ui/list'
import { useSnackbar } from '@/components/ui/snackbar'
import { TextField } from '@/components/ui/text-field'
import styles from './collections-dialog.module.scss'
import type { CollectionOption } from './types'

/** Pick the collections a recipe belongs to, or start a new one. */
export function CollectionsDialog({
    open,
    onOpenChange,
    recipeId,
    initial,
    collections,
    addIcon,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    recipeId: string
    initial: readonly string[]
    collections: CollectionOption[]
    addIcon: ReactNode
}) {
    const snackbar = useSnackbar()
    const [options, setOptions] = useState(collections)
    const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(initial))
    const [name, setName] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [creating, startCreate] = useTransition()
    const [saving, startSave] = useTransition()

    const create = (event?: FormEvent) => {
        event?.preventDefault()
        const trimmed = name.trim()
        if (!trimmed || creating) return
        startCreate(async () => {
            const result = await createCollection(trimmed)
            if (!result.ok) {
                setError(result.error)
                return
            }
            setError(null)
            setName('')
            setOptions((list) => [...list, { id: result.data.id, name: result.data.name }])
            setSelected((set) => new Set(set).add(result.data.id))
        })
    }

    const save = () => {
        startSave(async () => {
            const result = await setRecipeCollections(recipeId, [...selected])
            if (!result.ok) {
                snackbar({ message: result.error, urgent: true })
                return
            }
            onOpenChange(false)
            snackbar('Collections updated')
        })
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
            <DialogContent
                headline="Collections"
                actions={
                    <>
                        <Button variant="text" onClick={() => onOpenChange(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button variant="text" onClick={save} loading={saving}>
                            Save
                        </Button>
                    </>
                }
            >
                {options.length > 0 && (
                    <List className={styles.list} label="Collections">
                        {options.map((c) => (
                            <ListItem
                                key={c.id}
                                as="label"
                                className={styles.row}
                                leading={
                                    <Checkbox
                                        aria-label={c.name}
                                        checked={selected.has(c.id)}
                                        onCheckedChange={(value) =>
                                            setSelected((set) => {
                                                const next = new Set(set)
                                                if (value) next.add(c.id)
                                                else next.delete(c.id)
                                                return next
                                            })
                                        }
                                    />
                                }
                                headline={c.name}
                            />
                        ))}
                    </List>
                )}
                <form className={styles.create} onSubmit={create}>
                    <TextField
                        className={styles.field}
                        label="New collection"
                        variant="outlined"
                        value={name}
                        maxLength={60}
                        error={error ?? undefined}
                        onChange={(e) => {
                            setName(e.target.value)
                            setError(null)
                        }}
                        surfaceColor="var(--md-sys-color-surface-container-high)"
                    />
                    <IconButton
                        type="submit"
                        variant="tonal"
                        size="m"
                        label="Create collection"
                        icon={addIcon}
                        disabled={!name.trim() || creating}
                    />
                </form>
            </DialogContent>
        </Dialog>
    )
}
