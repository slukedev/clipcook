'use client'

import { type FormEvent, useState, useTransition } from 'react'
import { createCollection, deleteCollection, renameCollection } from '@/actions/collections'
import { Button } from '@/components/ui/button'
import {
    AlertDialog,
    AlertDialogClose,
    AlertDialogContent,
    Dialog,
    DialogClose,
    DialogContent,
} from '@/components/ui/dialog'
import { useSnackbar } from '@/components/ui/snackbar'
import { TextField } from '@/components/ui/text-field'
import { LIMITS } from '@/lib/domain/types'
import styles from './collection-dialogs.module.scss'

export type NameDialogTarget =
    | { mode: 'create'; key: number }
    | { mode: 'rename'; key: number; id: string; name: string }

interface NameDialogProps {
    target: NameDialogTarget | null
    onClose: () => void
    /** Called with the new collection's id after a create. */
    onCreated?: (id: string) => void
}

/** New collection, or rename one. */
export function CollectionNameDialog({ target, onClose, onCreated }: NameDialogProps) {
    const [shown, setShown] = useState(target)
    if (target && target !== shown) setShown(target)
    return (
        <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
            {shown && <NameForm key={shown.key} target={shown} onClose={onClose} onCreated={onCreated} />}
        </Dialog>
    )
}

function NameForm({ target, onClose, onCreated }: { target: NameDialogTarget } & Omit<NameDialogProps, 'target'>) {
    const snackbar = useSnackbar()
    const [name, setName] = useState(target.mode === 'rename' ? target.name : '')
    const [error, setError] = useState<string>()
    const [pending, startTransition] = useTransition()
    const formId = `collection-name-${target.key}`

    const submit = (event: FormEvent) => {
        event.preventDefault()
        const clean = name.trim()
        if (!clean) {
            setError('Enter a name.')
            return
        }
        if (target.mode === 'rename' && clean === target.name) {
            onClose()
            return
        }
        startTransition(async () => {
            if (target.mode === 'create') {
                const result = await createCollection(clean)
                if (!result.ok) return setError(result.error)
                onClose()
                onCreated?.(result.data.id)
            } else {
                const result = await renameCollection(target.id, clean)
                if (!result.ok) return setError(result.error)
                onClose()
                snackbar('Renamed')
            }
        })
    }

    return (
        <DialogContent
            headline={target.mode === 'create' ? 'New collection' : 'Rename collection'}
            actions={
                <>
                    <DialogClose render={<Button variant="text" />}>Cancel</DialogClose>
                    <Button variant="text" type="submit" form={formId} loading={pending}>
                        {target.mode === 'create' ? 'Create' : 'Save'}
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={submit} className={styles.form}>
                <TextField
                    label="Name"
                    value={name}
                    onChange={(event) => {
                        setName(event.target.value)
                        setError(undefined)
                    }}
                    maxLength={LIMITS.collectionName}
                    error={error}
                    autoComplete="off"
                    enterKeyHint="done"
                    autoFocus
                />
            </form>
        </DialogContent>
    )
}

interface DeleteDialogProps {
    target: { id: string; name: string } | null
    onClose: () => void
    onDeleted?: () => void
}

/** Confirms deleting a collection. Its recipes stay in the library. */
export function DeleteCollectionDialog({ target, onClose, onDeleted }: DeleteDialogProps) {
    const snackbar = useSnackbar()
    const [shown, setShown] = useState(target)
    const [pending, startTransition] = useTransition()
    if (target && target !== shown) setShown(target)

    const confirm = () => {
        if (!shown) return
        startTransition(async () => {
            const result = await deleteCollection(shown.id)
            if (!result.ok) {
                snackbar({ message: result.error, urgent: true })
                return
            }
            onClose()
            snackbar(`Deleted ${shown.name}`)
            onDeleted?.()
        })
    }

    return (
        <AlertDialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
            <AlertDialogContent
                headline={`Delete ${shown?.name ?? 'collection'}?`}
                actions={
                    <>
                        <AlertDialogClose render={<Button variant="text" />}>Cancel</AlertDialogClose>
                        <Button variant="text" onClick={confirm} loading={pending}>
                            Delete
                        </Button>
                    </>
                }
            >
                Its recipes stay in your library.
            </AlertDialogContent>
        </AlertDialog>
    )
}
