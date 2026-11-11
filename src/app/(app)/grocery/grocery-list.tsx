'use client'

import { LayoutGroup, MotionConfig, motion } from 'motion/react'
import Link from 'next/link'
import { type ReactNode, useEffect, useOptimistic, useRef, useState, useTransition } from 'react'
import {
    addGroceryLines,
    clearCheckedGroceries,
    clearGroceries,
    removeGroceryItem,
    setGroceryChecked,
    updateGroceryItem,
} from '@/actions/grocery'
import { Button } from '@/components/ui/button'
import { AssistChip, ChipSet } from '@/components/ui/chip'
import { AlertDialog, AlertDialogClose, AlertDialogContent } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { useSnackbar } from '@/components/ui/snackbar'
import { TopAppBar } from '@/components/ui/top-app-bar'
import { useSpring } from '@/lib/motion'
import type { ActionResult, GroceryCategory, GroceryItem } from '@/lib/domain/types'
import { addGroceryLines as mergeLines, groupGroceries, lineToGroceryItem } from '@/lib/recipe/grocery'
import { AddField } from './add-field'
import { CATEGORY_LABELS, shareText } from './categories'
import { GroceryRow } from './grocery-row'
import styles from './grocery.module.scss'
import { useStoredFlag, useWakeLock } from './store-mode'

export interface GroceryIcons {
    categories: Record<GroceryCategory, ReactNode>
    done: ReactNode
    add: ReactNode
    send: ReactNode
    share: ReactNode
    more: ReactNode
    delete: ReactNode
    clearAll: ReactNode
    clearChecked: ReactNode
    recipe: ReactNode
    empty: ReactNode
    browse: ReactNode
}

type Op =
    | { type: 'add'; lines: string[]; ids: string[]; now: number }
    | { type: 'check'; id: string; checked: boolean }
    | { type: 'edit'; id: string; text: string }
    | { type: 'remove'; id: string }
    | { type: 'clearChecked' }
    | { type: 'clearAll' }

/** The same merge the server runs, so the optimistic list matches what comes back. */
function reduce(items: GroceryItem[], op: Op): GroceryItem[] {
    switch (op.type) {
        case 'add': {
            let next = 0
            return mergeLines(items, op.lines, { now: op.now, newId: () => op.ids[next++] ?? `tmp-${next}` })
        }
        case 'check':
            return items.map((item) => (item.id === op.id ? { ...item, checked: op.checked } : item))
        case 'edit':
            return items.map((item) => {
                if (item.id !== op.id) return item
                const parsed = lineToGroceryItem(op.text, { now: item.addedAt, newId: () => item.id })
                return parsed ? { ...parsed, checked: item.checked, recipeIds: item.recipeIds } : item
            })
        case 'remove':
            return items.filter((item) => item.id !== op.id)
        case 'clearChecked':
            return items.filter((item) => !item.checked)
        case 'clearAll':
            return []
    }
}

let tmpCounter = 0
const tmpId = () => `tmp-${Date.now().toString(36)}-${tmpCounter++}`

const UNDO_MS = 8000

export function GroceryList({
    items,
    recipeTitles,
    icons,
}: {
    items: GroceryItem[]
    recipeTitles: Record<string, string>
    icons: GroceryIcons
}) {
    const snackbar = useSnackbar()
    const [, startTransition] = useTransition()

    // Server results and refreshed props both reset the base the optimistic layer sits on.
    const [base, setBase] = useState(items)
    const [prevItems, setPrevItems] = useState(items)
    if (items !== prevItems) {
        setPrevItems(items)
        setBase(items)
    }
    const [optimistic, applyOptimistic] = useOptimistic(base, reduce)

    // Deleted rows wait out the undo window before the server hears about them.
    const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
    const pendingDeletes = useRef(new Map<string, ReturnType<typeof setTimeout>>())
    useEffect(() => {
        const pending = pendingDeletes.current
        return () => {
            for (const [id, timer] of pending) {
                clearTimeout(timer)
                void removeGroceryItem(id)
            }
            pending.clear()
        }
    }, [])

    const [announcement, setAnnouncement] = useState('')
    const [confirmClear, setConfirmClear] = useState(false)
    const [copied, setCopied] = useState(false)
    const [largeText, setLargeText] = useStoredFlag('clipcook.grocery.large-text')
    const wake = useWakeLock()

    const spatial = useSpring('spatial-default')

    function run<T>(
        op: Op,
        action: () => Promise<ActionResult<T>>,
        fromResult?: (data: T, current: GroceryItem[]) => GroceryItem[],
    ) {
        startTransition(async () => {
            applyOptimistic(op)
            const res = await action()
            if (!res.ok) {
                snackbar(res.error)
                return
            }
            startTransition(() => setBase((current) => fromResult?.(res.data, current) ?? reduce(current, op)))
        })
    }

    function add(lines: string[]) {
        const clean = lines.map((line) => line.trim()).filter(Boolean)
        if (clean.length === 0) return
        run(
            { type: 'add', lines: clean, ids: clean.map(tmpId), now: Date.now() },
            () => addGroceryLines(clean),
            (list) => list,
        )
        setAnnouncement(clean.length === 1 ? `Added ${clean[0]}` : `Added ${clean.length} items`)
    }

    function toggle(item: GroceryItem) {
        const checked = !item.checked
        run({ type: 'check', id: item.id, checked }, () => setGroceryChecked(item.id, checked))
    }

    function edit(item: GroceryItem, text: string) {
        const clean = text.trim()
        if (!clean || clean === item.text) return
        run(
            { type: 'edit', id: item.id, text: clean },
            () => updateGroceryItem(item.id, clean),
            (saved, current) => current.map((i) => (i.id === saved.id ? saved : i)),
        )
    }

    function commitDelete(id: string) {
        pendingDeletes.current.delete(id)
        startTransition(async () => {
            applyOptimistic({ type: 'remove', id })
            const res = await removeGroceryItem(id)
            startTransition(() => {
                setHidden((current) => {
                    const next = new Set(current)
                    next.delete(id)
                    return next
                })
                if (res.ok) setBase((current) => reduce(current, { type: 'remove', id }))
            })
            if (!res.ok) snackbar(res.error)
        })
    }

    function remove(item: GroceryItem) {
        setHidden((current) => new Set(current).add(item.id))
        pendingDeletes.current.set(
            item.id,
            setTimeout(() => commitDelete(item.id), UNDO_MS),
        )
        setAnnouncement(`Removed ${item.text}`)
        snackbar({
            message: 'Item removed',
            action: 'Undo',
            duration: UNDO_MS,
            onAction: () => {
                clearTimeout(pendingDeletes.current.get(item.id))
                pendingDeletes.current.delete(item.id)
                setHidden((current) => {
                    const next = new Set(current)
                    next.delete(item.id)
                    return next
                })
            },
        })
    }

    function clearChecked() {
        run({ type: 'clearChecked' }, clearCheckedGroceries, (list) => list)
        setAnnouncement('Cleared done items')
    }

    function clearAll() {
        setConfirmClear(false)
        run({ type: 'clearAll' }, clearGroceries)
        setAnnouncement('List cleared')
    }

    async function share(list: GroceryItem[]) {
        const text = shareText(list)
        if (typeof navigator.share === 'function' && navigator.canShare?.({ text }) !== false) {
            try {
                await navigator.share({ title: 'Grocery list', text })
                return
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return
            }
        }
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setAnnouncement('Copied')
            setTimeout(() => setCopied(false), 2000)
        } catch {
            snackbar('Could not copy the list. Try again.')
        }
    }

    const visible = optimistic.filter((item) => !hidden.has(item.id))
    const open = visible.filter((item) => !item.checked)
    const done = groupGroceries(visible.filter((item) => item.checked)).flatMap((group) => group.items)
    const groups = groupGroceries(open)
    const recipeIds = [...new Set(visible.flatMap((item) => item.recipeIds))].filter((id) => recipeTitles[id])
    const empty = visible.length === 0

    const rowHandlers = { onToggle: toggle, onEdit: edit, onDelete: remove }

    return (
        <MotionConfig transition={spatial} reducedMotion="user">
            <div className={styles.page} data-large={largeText || undefined}>
                <TopAppBar
                    variant="medium"
                    title="Grocery list"
                    subtitle={empty ? undefined : open.length === 0 ? 'All done' : `${open.length} left`}
                    trailing={
                        <>
                            <IconButton
                                label={copied ? 'Copied' : 'Share'}
                                icon={copied ? icons.done : icons.share}
                                disabled={open.length === 0}
                                onClick={() => share(visible)}
                            />
                            <Menu>
                                <MenuTrigger render={<IconButton label="More" icon={icons.more} />} />
                                <MenuContent align="end">
                                    {wake.supported && (
                                        <MenuCheckboxItem checked={wake.active} onCheckedChange={wake.setActive}>
                                            Keep screen on
                                        </MenuCheckboxItem>
                                    )}
                                    <MenuCheckboxItem checked={largeText} onCheckedChange={setLargeText}>
                                        Large text
                                    </MenuCheckboxItem>
                                    <MenuSeparator />
                                    <MenuItem
                                        icon={icons.clearChecked}
                                        disabled={done.length === 0}
                                        onClick={clearChecked}
                                    >
                                        Clear done
                                    </MenuItem>
                                    <MenuItem
                                        icon={icons.clearAll}
                                        disabled={empty}
                                        onClick={() => setConfirmClear(true)}
                                    >
                                        Clear list
                                    </MenuItem>
                                </MenuContent>
                            </Menu>
                        </>
                    }
                />

                <div className={styles.body}>
                    <div className={styles.top}>
                        <AddField onAdd={add} addIcon={icons.add} submitIcon={icons.send} />
                        {recipeIds.length > 0 && (
                            <section className={styles.recipes} aria-labelledby="grocery-from">
                                <h2 id="grocery-from" className={styles.recipesLabel}>
                                    From recipes
                                </h2>
                                <ChipSet scroll label="From recipes">
                                    {recipeIds.map((id) => (
                                        <AssistChip
                                            key={id}
                                            icon={icons.recipe}
                                            render={<Link href={`/recipe/${id}`} />}
                                            nativeButton={false}
                                        >
                                            {recipeTitles[id]}
                                        </AssistChip>
                                    ))}
                                </ChipSet>
                            </section>
                        )}
                    </div>

                    {empty ? (
                        <EmptyState
                            className={styles.empty}
                            shape="cookie9"
                            icon={icons.empty}
                            title="Nothing on the list"
                            action={
                                <Button
                                    variant="tonal"
                                    icon={icons.browse}
                                    render={<Link href="/" />}
                                    nativeButton={false}
                                >
                                    Browse recipes
                                </Button>
                            }
                        />
                    ) : (
                        <LayoutGroup>
                            <div className={styles.groups}>
                                {groups.map((group) => (
                                    <motion.section
                                        layout="position"
                                        key={group.category}
                                        className={styles.group}
                                        aria-labelledby={`aisle-${group.category}`}
                                    >
                                        <GroupHeader
                                            id={`aisle-${group.category}`}
                                            icon={icons.categories[group.category]}
                                            label={CATEGORY_LABELS[group.category]}
                                            count={group.items.length}
                                        />
                                        <ul className={styles.rows}>
                                            {group.items.map((item) => (
                                                <GroceryRow
                                                    key={item.id}
                                                    item={item}
                                                    deleteIcon={icons.delete}
                                                    {...rowHandlers}
                                                />
                                            ))}
                                        </ul>
                                    </motion.section>
                                ))}
                                {done.length > 0 && (
                                    <motion.section
                                        layout="position"
                                        key="done"
                                        className={styles.group}
                                        data-done=""
                                        aria-labelledby="aisle-done"
                                    >
                                        <GroupHeader
                                            id="aisle-done"
                                            icon={icons.done}
                                            label="Done"
                                            count={done.length}
                                            action={
                                                <Button variant="text" size="s" onClick={clearChecked}>
                                                    Clear
                                                </Button>
                                            }
                                        />
                                        <ul className={styles.rows}>
                                            {done.map((item) => (
                                                <GroceryRow
                                                    key={item.id}
                                                    item={item}
                                                    deleteIcon={icons.delete}
                                                    {...rowHandlers}
                                                />
                                            ))}
                                        </ul>
                                    </motion.section>
                                )}
                            </div>
                        </LayoutGroup>
                    )}
                </div>

                <p className={styles.srOnly} role="status" aria-live="polite">
                    {announcement}
                </p>

                <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
                    <AlertDialogContent
                        headline="Clear the list?"
                        actions={
                            <>
                                <AlertDialogClose render={<Button variant="text" />}>Cancel</AlertDialogClose>
                                <Button variant="text" onClick={clearAll}>
                                    Clear
                                </Button>
                            </>
                        }
                    >
                        Every item is removed, done or not.
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </MotionConfig>
    )
}

function GroupHeader({
    id,
    icon,
    label,
    count,
    action,
}: {
    id: string
    icon: ReactNode
    label: string
    count: number
    action?: ReactNode
}) {
    return (
        <div className={styles.groupHeader}>
            <span className={styles.groupIcon} aria-hidden>
                {icon}
            </span>
            <h2 id={id} className={styles.groupTitle}>
                {label}
            </h2>
            <span className={styles.groupCount}>{count}</span>
            {action && <span className={styles.groupAction}>{action}</span>}
        </div>
    )
}
