'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useState, useTransition } from 'react'
import { addGroceryLines } from '@/actions/grocery'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { List, ListItem } from '@/components/ui/list'
import { useSnackbar } from '@/components/ui/snackbar'
import { scaledLines } from '@/lib/cook/content'
import { AdaptiveSheet } from './adaptive-sheet'
import styles from './grocery-sheet.module.scss'

/** "Add to list": pick which ingredients (at the current scale) go on the grocery list. */
export function GrocerySheet({
    recipeId,
    ingredients,
    scale,
    icon,
}: {
    recipeId: string
    ingredients: string[]
    scale: number
    icon: ReactNode
}) {
    const router = useRouter()
    const snackbar = useSnackbar()
    const [open, setOpen] = useState(false)
    const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set())
    const [pending, startTransition] = useTransition()
    const lines = scaledLines(ingredients, scale)
    const selected = lines.filter((l) => !excluded.has(l.index))
    const all = selected.length === lines.length

    const submit = () => {
        if (selected.length === 0 || pending) return
        startTransition(async () => {
            const result = await addGroceryLines(
                selected.map((l) => l.text),
                recipeId,
            )
            if (!result.ok) {
                snackbar({ message: result.error, urgent: true })
                return
            }
            setOpen(false)
            const n = selected.length
            snackbar({
                message: n === 1 ? 'Added 1 item' : `Added ${n} items`,
                action: 'View list',
                onAction: () => router.push('/grocery'),
            })
        })
    }

    return (
        <>
            <Button
                variant="tonal"
                size="s"
                icon={icon}
                onClick={() => {
                    setExcluded(new Set())
                    setOpen(true)
                }}
            >
                Add to list
            </Button>
            <AdaptiveSheet
                open={open}
                onOpenChange={(next) => !pending && setOpen(next)}
                title="Add to Grocery List"
                actions={
                    <>
                        <Button variant="text" onClick={() => setOpen(false)} disabled={pending}>
                            Cancel
                        </Button>
                        <Button onClick={submit} loading={pending} disabled={selected.length === 0}>
                            {selected.length === lines.length ? 'Add all' : `Add ${selected.length}`}
                        </Button>
                    </>
                }
            >
                <Checkbox
                    className={styles.all}
                    label="Select all"
                    checked={all}
                    indeterminate={!all && selected.length > 0}
                    onCheckedChange={(value) => setExcluded(value ? new Set() : new Set(lines.map((l) => l.index)))}
                />
                <List className={styles.list} label="Ingredients">
                    {lines.map((line) => (
                        <ListItem
                            key={line.index}
                            as="label"
                            className={styles.row}
                            leading={
                                <Checkbox
                                    aria-label={line.text}
                                    checked={!excluded.has(line.index)}
                                    onCheckedChange={(value) =>
                                        setExcluded((current) => {
                                            const next = new Set(current)
                                            if (value) next.delete(line.index)
                                            else next.add(line.index)
                                            return next
                                        })
                                    }
                                />
                            }
                            headline={line.text}
                        />
                    ))}
                </List>
            </AdaptiveSheet>
        </>
    )
}
