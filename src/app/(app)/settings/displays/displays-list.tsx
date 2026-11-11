'use client'

import { type ReactNode, useEffect, useOptimistic, useState, useTransition } from 'react'
import { clearDisplay, removeDisplay, renameDisplay } from '@/actions/displays'
import { Button } from '@/components/ui/button'
import {
    AlertDialog,
    AlertDialogClose,
    AlertDialogContent,
    Dialog,
    DialogClose,
    DialogContent,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { Shape } from '@/components/ui/shape'
import { useSnackbar } from '@/components/ui/snackbar'
import { TextField } from '@/components/ui/text-field'
import type { ActionResult, KitchenDisplay } from '@/lib/domain/types'
import { LIMITS } from '@/lib/domain/types'
import styles from './displays.module.scss'
import { isActive, lastSeenLabel } from './last-seen'

interface Icons {
    display: ReactNode
    add: ReactNode
    more: ReactNode
    edit: ReactNode
    clear: ReactNode
    remove: ReactNode
}

type Op = { type: 'rename'; id: string; name: string } | { type: 'clear'; id: string } | { type: 'remove'; id: string }

function reduce(list: KitchenDisplay[], op: Op): KitchenDisplay[] {
    switch (op.type) {
        case 'rename':
            return list.map((d) => (d.id === op.id ? { ...d, name: op.name } : d))
        case 'clear':
            return list.map((d) => (d.id === op.id ? { ...d, current: null } : d))
        case 'remove':
            return list.filter((d) => d.id !== op.id)
    }
}

/** Re-renders once a minute so "2 min ago" stays true. Starts from the server's clock. */
function useMinuteClock(initial: number): number {
    const [now, setNow] = useState(initial)
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 30_000)
        return () => clearInterval(id)
    }, [])
    return now
}

export function DisplaysList({
    displays,
    recipeTitles,
    now: serverNow,
    steps,
    icons,
}: {
    displays: KitchenDisplay[]
    recipeTitles: Record<string, string>
    now: number
    steps: ReactNode
    icons: Icons
}) {
    const snackbar = useSnackbar()
    const now = useMinuteClock(serverNow)
    const [list, apply] = useOptimistic(displays, reduce)
    const [, startTransition] = useTransition()
    const [renaming, setRenaming] = useState<KitchenDisplay | null>(null)
    const [removing, setRemoving] = useState<KitchenDisplay | null>(null)
    const [adding, setAdding] = useState(false)

    function run(op: Op, action: () => Promise<ActionResult>, done?: string) {
        startTransition(async () => {
            apply(op)
            const res = await action()
            if (!res.ok) snackbar(res.error)
            else if (done) snackbar(done)
        })
    }

    function showing(display: KitchenDisplay): string | null {
        const current = display.current
        if (!current) return null
        const title = recipeTitles[current.recipeId] ?? 'a recipe'
        return current.step === null ? `Showing ${title}` : `${title}, step ${current.step + 1}`
    }

    return (
        <section className={styles.listPane} aria-label="Your displays">
            <div className={styles.listHeader}>
                <Button icon={icons.add} className={styles.addButton} onClick={() => setAdding(true)}>
                    Add display
                </Button>
            </div>

            {list.length === 0 ? (
                <EmptyState
                    className={styles.empty}
                    shape="cookie12"
                    icon={icons.display}
                    title="No displays yet"
                    titleAs="h2"
                />
            ) : (
                <ul className={styles.list}>
                    {list.map((display) => {
                        const active = isActive(display.lastSeenAt, now)
                        const status = showing(display)
                        return (
                            <li key={display.id} className={styles.display}>
                                <span className={styles.displayArt} data-active={active || undefined} aria-hidden>
                                    <Shape name="cookie9" className={styles.displayShape} />
                                    <span className={styles.displayIcon}>{icons.display}</span>
                                </span>
                                <div className={styles.displayText}>
                                    <h3 className={styles.displayName}>{display.name}</h3>
                                    <p className={styles.displayMeta}>
                                        <span data-active={active || undefined}>
                                            {lastSeenLabel(display.lastSeenAt, now)}
                                        </span>
                                        {status && <span className={styles.showing}>{status}</span>}
                                    </p>
                                </div>
                                <Menu>
                                    <MenuTrigger
                                        render={<IconButton label={`${display.name} options`} icon={icons.more} />}
                                    />
                                    <MenuContent align="end">
                                        <MenuItem icon={icons.edit} onClick={() => setRenaming(display)}>
                                            Rename
                                        </MenuItem>
                                        <MenuItem
                                            icon={icons.clear}
                                            disabled={!display.current}
                                            onClick={() =>
                                                run({ type: 'clear', id: display.id }, () => clearDisplay(display.id))
                                            }
                                        >
                                            Clear screen
                                        </MenuItem>
                                        <MenuSeparator />
                                        <MenuItem icon={icons.remove} onClick={() => setRemoving(display)}>
                                            Remove
                                        </MenuItem>
                                    </MenuContent>
                                </Menu>
                            </li>
                        )
                    })}
                </ul>
            )}

            <Dialog open={adding} onOpenChange={setAdding}>
                <DialogContent
                    headline="Add a display"
                    actions={<DialogClose render={<Button variant="text" />}>Close</DialogClose>}
                >
                    {steps}
                </DialogContent>
            </Dialog>

            <RenameDialog
                display={renaming}
                taken={list.filter((d) => d.id !== renaming?.id).map((d) => d.name)}
                onClose={() => setRenaming(null)}
                onSave={(display, name) =>
                    run({ type: 'rename', id: display.id, name }, () => renameDisplay(display.id, name))
                }
            />

            <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
                <AlertDialogContent
                    headline={`Remove ${removing?.name ?? 'display'}?`}
                    actions={
                        <>
                            <AlertDialogClose render={<Button variant="text" />}>Cancel</AlertDialogClose>
                            <Button
                                variant="text"
                                onClick={() => {
                                    const display = removing
                                    setRemoving(null)
                                    if (display) {
                                        run(
                                            { type: 'remove', id: display.id },
                                            () => removeDisplay(display.id),
                                            `${display.name} removed`,
                                        )
                                    }
                                }}
                            >
                                Remove
                            </Button>
                        </>
                    }
                >
                    It signs out and shows a new code.
                </AlertDialogContent>
            </AlertDialog>
        </section>
    )
}

function RenameDialog({
    display,
    taken,
    onClose,
    onSave,
}: {
    display: KitchenDisplay | null
    /** The other displays' names: two screens with one name cannot be told apart when sending. */
    taken: readonly string[]
    onClose: () => void
    onSave: (display: KitchenDisplay, name: string) => void
}) {
    const [name, setName] = useState('')
    const [prevId, setPrevId] = useState<string | null>(null)
    if ((display?.id ?? null) !== prevId) {
        setPrevId(display?.id ?? null)
        if (display) setName(display.name)
    }
    const clean = name.trim()
    const clash = taken.some((t) => t.trim().toLocaleLowerCase() === clean.toLocaleLowerCase())
    const save = () => {
        if (!display || !clean || clash) return
        onClose()
        if (clean !== display.name) onSave(display, clean)
    }
    return (
        <Dialog open={display !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                headline="Rename display"
                actions={
                    <>
                        <DialogClose render={<Button variant="text" />}>Cancel</DialogClose>
                        <Button variant="text" disabled={!clean || clash} onClick={save}>
                            Save
                        </Button>
                    </>
                }
            >
                <form
                    onSubmit={(event) => {
                        event.preventDefault()
                        save()
                    }}
                >
                    <TextField
                        label="Name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={LIMITS.displayName}
                        autoComplete="off"
                        error={clash ? 'Another display has this name.' : undefined}
                        autoFocus
                    />
                </form>
            </DialogContent>
        </Dialog>
    )
}
