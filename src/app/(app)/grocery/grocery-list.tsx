'use client'

import { LayoutGroup, MotionConfig, motion } from 'motion/react'
import Link from 'next/link'
import { type ReactNode, useEffect, useEffectEvent, useOptimistic, useRef, useState, useTransition } from 'react'
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
import { readJson, writeJson } from '@/lib/cook/storage'
import type { ActionResult, GroceryCategory, GroceryItem } from '@/lib/domain/types'
import { useSpring } from '@/lib/motion'
import { useSessionUser } from '../_shell/session-context'
import { AddField } from './add-field'
import { CATEGORY_LABELS, groupByAisle, shareText } from './categories'
import styles from './grocery.module.scss'
import { GroceryRow } from './grocery-row'
import { type PastItem, parseHistory, remember, suggestions } from './history'
import { applyOp, applyOps, compactOps, type GroceryOp, idsAfterAdd, parseQueue, remapOps } from './ops'
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
    offline: ReactNode
}

let tmpCounter = 0
const tmpId = () => `tmp-${Date.now().toString(36)}-${tmpCounter++}`

const UNDO_MS = 8000
/** A checked row stays in its aisle this long, so the list does not shift under a thumb mid-tap. */
const LINGER_MS = 1500
/** Waits between retries while changes are waiting for a connection. */
const RETRY_MS = [3000, 8000, 20_000, 45_000]

const queueKey = (uid: string) => `clipcook.grocery.queue.${uid}`
const historyKey = (uid: string) => `clipcook.grocery.history.${uid}`

function readQueue(uid: string): GroceryOp[] {
    return parseQueue(JSON.stringify(readJson<unknown>('local', queueKey(uid), [])))
}

function send(op: GroceryOp): Promise<ActionResult<unknown>> {
    switch (op.type) {
        case 'add':
            return addGroceryLines(op.lines)
        case 'check':
            return setGroceryChecked(op.id, op.checked)
        case 'edit':
            return updateGroceryItem(op.id, op.text)
        case 'remove':
            return removeGroceryItem(op.id)
        case 'clearChecked':
            return clearCheckedGroceries()
        case 'clearAll':
            return clearGroceries()
    }
}

/** The list after the server answered. Adds and clears return the whole list; edits return the row. */
function settle(op: GroceryOp, data: unknown, current: GroceryItem[]): GroceryItem[] {
    if (op.type === 'add' || op.type === 'clearChecked') return data as GroceryItem[]
    if (op.type === 'edit') {
        const saved = data as GroceryItem
        return current.map((item) => (item.id === saved.id ? saved : item))
    }
    return applyOp(current, op)
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

export function GroceryList({
    items,
    recipeTitles,
    icons,
}: {
    items: GroceryItem[]
    recipeTitles: Record<string, string>
    icons: GroceryIcons
}) {
    const { uid } = useSessionUser()
    const snackbar = useSnackbar()
    const [, startTransition] = useTransition()

    // Server results and refreshed props both reset the base the optimistic layer sits on.
    const [base, setBase] = useState(items)
    const [prevItems, setPrevItems] = useState(items)
    if (items !== prevItems) {
        setPrevItems(items)
        setBase(items)
    }
    const [optimistic, applyOptimistic] = useOptimistic(base, applyOp)

    // Changes that could not reach the server wait here, on this device, and sync in order.
    // The ref is the source of truth so a burst of taps never reads a stale queue.
    const [queue, setQueueState] = useState<GroceryOp[]>([])
    const queueRef = useRef<GroceryOp[]>([])
    const [offline, setOffline] = useState(false)
    /** Bumps after each queued change lands, so the next one goes out. */
    const [sent, setSent] = useState(0)
    const flushing = useRef(false)
    const attempts = useRef(0)

    function commitQueue(next: GroceryOp[]) {
        const compact = compactOps(next)
        queueRef.current = compact
        writeJson('local', queueKey(uid), compact.length ? compact : null)
        setQueueState(compact)
    }

    function enqueue(op: GroceryOp) {
        commitQueue([...queueRef.current, op])
    }

    // Deleted rows wait out the undo window before the server hears about them.
    const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
    const pendingDeletes = useRef(new Map<string, ReturnType<typeof setTimeout>>())

    // Checked rows linger in their aisle for a moment before moving to Done.
    const [lingering, setLingering] = useState<ReadonlySet<string>>(() => new Set())
    const lingerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    const [history, setHistory] = useState<PastItem[]>([])

    const [announcement, setAnnouncement] = useState('')
    const [confirmClear, setConfirmClear] = useState(false)
    const [copied, setCopied] = useState(false)
    const [largeText, setLargeText] = useStoredFlag('clipcook.grocery.large-text')
    const wake = useWakeLock()

    const spatial = useSpring('spatial-default')

    // This device's waiting changes and past items load after hydration; the server cannot see them.
    const onMount = useEffectEvent(() => {
        const stored = readQueue(uid)
        queueRef.current = stored
        setQueueState(stored)
        if (isOffline()) setOffline(true)
        const past = parseHistory(JSON.stringify(readJson<unknown>('local', historyKey(uid), [])))
        // A first visit on this device learns from the list itself.
        const seeded = past.length ? past : remember([], items.map((item) => item.text).reverse(), Date.now())
        setHistory(seeded)
    })
    useEffect(() => {
        onMount()
    }, [])

    useEffect(() => {
        const pending = pendingDeletes.current
        const linger = lingerTimer
        return () => {
            clearTimeout(linger.current)
            for (const [id, timer] of pending) {
                clearTimeout(timer)
                // Leaving the page keeps the delete; offline, it waits with the other changes.
                removeGroceryItem(id).catch(() => {
                    writeJson('local', queueKey(uid), [...readQueue(uid), { type: 'remove', id }])
                })
            }
            pending.clear()
        }
    }, [uid])

    function wentOffline() {
        setOffline(true)
    }

    function run(op: GroceryOp, before?: () => void) {
        // Keep order: once something is waiting, everything after it waits too.
        if (queueRef.current.length > 0 || isOffline()) {
            before?.()
            enqueue(op)
            if (isOffline()) wentOffline()
            return
        }
        startTransition(async () => {
            before?.()
            applyOptimistic(op)
            let res: ActionResult<unknown>
            try {
                res = await send(op)
            } catch {
                // No connection: the change stays on screen and syncs later.
                startTransition(() => enqueue(op))
                wentOffline()
                return
            }
            if (!res.ok) {
                if (op.type !== 'remove') snackbar(res.error)
                return
            }
            const data = res.data
            startTransition(() => setBase((current) => settle(op, data, current)))
        })
    }

    /** Sends the oldest waiting change; the effect below calls again until the queue is empty. */
    function flush() {
        const op = queueRef.current[0]
        if (!op || flushing.current || isOffline()) return
        flushing.current = true
        const before = base
        startTransition(async () => {
            commitQueue(queueRef.current.slice(1))
            applyOptimistic(op)
            let res: ActionResult<unknown>
            try {
                res = await send(op)
            } catch {
                startTransition(() => commitQueue([op, ...queueRef.current]))
                flushing.current = false
                wentOffline()
                return
            }
            flushing.current = false
            attempts.current = 0
            setOffline(false)
            if (!res.ok) {
                setSent((n) => n + 1)
                // A row deleted on another device is not worth a message.
                if (op.type !== 'remove' && op.type !== 'check') snackbar(res.error)
                return
            }
            const data = res.data
            startTransition(() => {
                if (op.type === 'add') {
                    commitQueue(remapOps(queueRef.current, idsAfterAdd(before, op, data as GroceryItem[])))
                }
                setBase((current) => settle(op, data, current))
                setSent((n) => n + 1)
            })
        })
    }

    const onQueueChange = useEffectEvent(() => flush())
    useEffect(() => {
        if (queue.length > 0 && !offline && sent >= 0) onQueueChange()
    }, [queue, offline, sent])

    // Back online: the browser says so, the tab comes back, or a quiet retry gets through.
    useEffect(() => {
        if (!offline) return
        const retry = () => {
            if (!isOffline()) setOffline(false)
        }
        const delay = RETRY_MS[Math.min(attempts.current, RETRY_MS.length - 1)]
        attempts.current++
        const timer = setTimeout(retry, delay)
        const onVisible = () => document.visibilityState === 'visible' && retry()
        window.addEventListener('online', retry)
        document.addEventListener('visibilitychange', onVisible)
        return () => {
            clearTimeout(timer)
            window.removeEventListener('online', retry)
            document.removeEventListener('visibilitychange', onVisible)
        }
    }, [offline])

    function add(lines: string[]) {
        const clean = lines.map((line) => line.trim()).filter(Boolean)
        if (clean.length === 0) return
        run({ type: 'add', lines: clean, ids: clean.map(tmpId), now: Date.now() })
        setHistory((current) => {
            const next = remember(current, clean, Date.now())
            writeJson('local', historyKey(uid), next)
            return next
        })
        setAnnouncement(clean.length === 1 ? `Added ${clean[0]}` : `Added ${clean.length} items`)
    }

    function toggle(item: GroceryItem) {
        const checked = !item.checked
        setLingering((current) => {
            const next = new Set(current)
            if (checked) next.add(item.id)
            else next.delete(item.id)
            return next
        })
        if (checked) {
            clearTimeout(lingerTimer.current)
            lingerTimer.current = setTimeout(() => setLingering(new Set()), LINGER_MS)
        }
        run({ type: 'check', id: item.id, checked })
    }

    function edit(item: GroceryItem, text: string) {
        const clean = text.trim()
        if (!clean || clean === item.text) return
        run({ type: 'edit', id: item.id, text: clean })
    }

    function unhide(id: string) {
        setHidden((current) => {
            const next = new Set(current)
            next.delete(id)
            return next
        })
    }

    function commitDelete(id: string) {
        pendingDeletes.current.delete(id)
        run({ type: 'remove', id }, () => unhide(id))
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
                unhide(item.id)
            },
        })
    }

    function clearChecked() {
        run({ type: 'clearChecked' })
        setAnnouncement('Cleared done items')
    }

    function clearAll() {
        setConfirmClear(false)
        run({ type: 'clearAll' })
        setAnnouncement('List cleared')
    }

    async function share(list: GroceryItem[]) {
        const text = shareText(list)
        if (typeof navigator.share === 'function' && navigator.canShare?.({ text }) !== false) {
            try {
                await navigator.share({ title: 'Grocery List', text })
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

    const shown = applyOps(optimistic, queue)
    const visible = shown.filter((item) => !hidden.has(item.id))
    const open = visible.filter((item) => !item.checked)
    const groups = groupByAisle(visible.filter((item) => !item.checked || lingering.has(item.id)))
    const done = groupByAisle(visible.filter((item) => item.checked && !lingering.has(item.id))).flatMap(
        (group) => group.items,
    )
    const recipeIds = [...new Set(visible.flatMap((item) => item.recipeIds))].filter((id) => recipeTitles[id])
    const empty = visible.length === 0

    const rowHandlers = { onToggle: toggle, onEdit: edit, onDelete: remove }

    return (
        <MotionConfig transition={spatial} reducedMotion="user">
            <div className={styles.page} data-large={largeText || undefined}>
                <TopAppBar
                    variant="medium"
                    title="Grocery List"
                    subtitle={empty ? undefined : open.length === 0 ? 'All done' : `${open.length} left`}
                    trailing={
                        <>
                            <IconButton
                                label={copied ? 'Copied' : 'Share list'}
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
                        {offline && (
                            <p className={styles.offline} role="status">
                                <span className={styles.offlineIcon} aria-hidden>
                                    {icons.offline}
                                </span>
                                {queue.length > 0 ? 'Offline. Changes will sync.' : 'Offline'}
                            </p>
                        )}
                        <AddField
                            onAdd={add}
                            suggest={(query) => suggestions(history, visible, query)}
                            addIcon={icons.add}
                            submitIcon={icons.send}
                        />
                        {recipeIds.length > 0 && (
                            <section className={styles.recipes} aria-labelledby="grocery-from">
                                <h2 id="grocery-from" className={styles.recipesLabel}>
                                    From Recipes
                                </h2>
                                <ChipSet scroll bleed label="From recipes">
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
                            title="Nothing on the List"
                            action={
                                <Button
                                    variant="tonal"
                                    icon={icons.browse}
                                    render={<Link href="/" />}
                                    nativeButton={false}
                                >
                                    Add from a recipe
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
                                            count={group.items.filter((item) => !item.checked).length}
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
                        headline="Clear the List?"
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
            {count > 0 && <span className={styles.groupCount}>{count}</span>}
            {action && <span className={styles.groupAction}>{action}</span>}
        </div>
    )
}
