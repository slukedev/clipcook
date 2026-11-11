'use client'

import {
    type ClipboardEvent,
    type KeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
} from 'react'
import { flushSync } from 'react-dom'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { useSnackbar } from '@/components/ui/snackbar'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import type { EditorIcons } from './icons'
import styles from './line-list.module.scss'
import { type EditorLine, newLineId } from './values'

export type LinesUpdate = (update: (prev: EditorLine[]) => EditorLine[]) => void

interface LineListProps {
    kind: 'ingredient' | 'step'
    lines: EditorLine[]
    onChange: LinesUpdate
    icons: EditorIcons
}

const COPY = {
    ingredient: { title: 'Ingredients', one: 'Ingredient', add: 'Add ingredient', deleted: 'Ingredient deleted' },
    step: { title: 'Steps', one: 'Step', add: 'Add step', deleted: 'Step deleted' },
} as const

const LIST_MARK = /^\s*(?:[-*•·▪◦‣⁃○●□■▢☐✓✔]+|\d{1,3}\s*[.)]|step\s*\d{1,3}\s*[:.)-]?)\s*/i

/** Pasted text → rows: bullets and numbering go, '# x' and short 'x:' lines become headings. */
export function splitPasted(text: string): Omit<EditorLine, 'id'>[] {
    const out: Omit<EditorLine, 'id'>[] = []
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.replace(/\s+/g, ' ').trim()
        if (!line) continue
        const md = /^#{1,6}\s+(.+)$/.exec(line)
        if (md?.[1]) {
            out.push({ text: md[1].replace(/:$/, '').trim(), heading: true })
            continue
        }
        if (line.endsWith(':') && line.length <= 60 && !/^\d/.test(line)) {
            out.push({ text: line.slice(0, -1).trim(), heading: true })
            continue
        }
        const text = line.replace(LIST_MARK, '').trim()
        if (text) out.push({ text, heading: false })
    }
    return out
}

function move<T>(list: readonly T[], from: number, to: number): T[] {
    const next = list.slice()
    const [item] = next.splice(from, 1)
    if (item !== undefined) next.splice(to, 0, item)
    return next
}

function autoGrow(el: HTMLTextAreaElement) {
    if (CSS.supports('field-sizing', 'content')) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
}

interface Drag {
    id: string
    pointerId: number
    from: number
    to: number
    startPageY: number
    lastClientY: number
    tops: number[]
    heights: number[]
    gap: number
    frame: number
    rows: HTMLElement[]
}

const EDGE = 72

/** Rich list editor for ingredients or steps: inline editing, reorder, headings, paste. */
export function LineList({ kind, lines, onChange, icons }: LineListProps) {
    const copy = COPY[kind]
    const titleId = useId()
    const hintId = useId()
    const snackbar = useSnackbar()
    const listRef = useRef<HTMLOListElement>(null)
    const inputs = useRef(new Map<string, HTMLTextAreaElement>())
    const rows = useRef(new Map<string, HTMLLIElement>())
    const pendingFocus = useRef<{ id: string; caret: number | 'end' } | null>(null)
    const drag = useRef<Drag | null>(null)
    const [announcement, setAnnouncement] = useState('')

    // Focus after the rows exist (new row, deleted row, moved row).
    useLayoutEffect(() => {
        const target = pendingFocus.current
        if (!target) return
        const el = inputs.current.get(target.id)
        if (!el) return
        pendingFocus.current = null
        el.focus({ preventScroll: false })
        const at = target.caret === 'end' ? el.value.length : target.caret
        el.setSelectionRange(at, at)
    })

    useEffect(() => () => cancelAnimationFrame(drag.current?.frame ?? 0), [])

    let number = 0
    const numbers = lines.map((line) => (line.heading ? 0 : ++number))
    const count = lines.length

    function focusLater(id: string, caret: number | 'end') {
        pendingFocus.current = { id, caret }
    }

    function update(id: string, patch: Partial<EditorLine>) {
        onChange((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
    }

    function add() {
        const id = newLineId()
        focusLater(id, 0)
        onChange((prev) => [...prev, { id, text: '', heading: false }])
    }

    function insertAfter(index: number, text: string) {
        const id = newLineId()
        focusLater(id, 0)
        onChange((prev) => {
            const next = prev.slice()
            next.splice(index + 1, 0, { id, text, heading: false })
            return next
        })
    }

    function remove(index: number, withUndo: boolean) {
        const line = lines[index]
        if (!line) return
        const neighbor = lines[index - 1] ?? lines[index + 1]
        if (neighbor) focusLater(neighbor.id, 'end')
        onChange((prev) => prev.filter((l) => l.id !== line.id))
        if (withUndo && line.text.trim()) {
            snackbar({
                message: copy.deleted,
                action: 'Undo',
                onAction: () =>
                    onChange((prev) => {
                        if (prev.some((l) => l.id === line.id)) return prev
                        const next = prev.slice()
                        next.splice(Math.min(index, next.length), 0, line)
                        return next
                    }),
            })
        }
    }

    function moveBy(index: number, delta: number, focusId?: string) {
        const to = index + delta
        if (to < 0 || to >= count) return
        const line = lines[index]
        if (!line) return
        if (focusId) focusLater(focusId, 'end')
        onChange((prev) => move(prev, index, to))
        setAnnouncement(`Moved to position ${to + 1} of ${count}`)
    }

    function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, index: number) {
        const el = event.currentTarget
        const line = lines[index]
        if (!line || event.nativeEvent.isComposing) return
        if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            event.preventDefault()
            pendingFocus.current = { id: line.id, caret: el.selectionStart }
            moveBy(index, event.key === 'ArrowUp' ? -1 : 1)
            return
        }
        const { selectionStart: start, selectionEnd: end, value } = el
        if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
            event.preventDefault()
            update(line.id, { text: value.slice(0, start) })
            insertAfter(index, value.slice(end))
            return
        }
        if (event.key === 'Backspace' && start === 0 && end === 0) {
            if (line.heading) {
                event.preventDefault()
                update(line.id, { heading: false })
                return
            }
            if (value === '' && count > 1) {
                event.preventDefault()
                remove(index, false)
            }
            return
        }
        if (event.key === 'ArrowUp' && start === 0 && end === 0 && index > 0) {
            const prev = lines[index - 1]
            if (prev) {
                event.preventDefault()
                inputs.current.get(prev.id)?.focus()
            }
            return
        }
        if (event.key === 'ArrowDown' && start === value.length && end === value.length && index < count - 1) {
            const next = lines[index + 1]
            const target = next && inputs.current.get(next.id)
            if (target) {
                event.preventDefault()
                target.focus()
                target.setSelectionRange(0, 0)
            }
        }
    }

    function onPaste(event: ClipboardEvent<HTMLTextAreaElement>, index: number) {
        const text = event.clipboardData.getData('text/plain')
        if (!/\n/.test(text.trim())) return
        const parts = splitPasted(text)
        if (parts.length < 2) return
        event.preventDefault()
        const el = event.currentTarget
        const line = lines[index]
        if (!line) return
        const before = el.value.slice(0, el.selectionStart)
        const after = el.value.slice(el.selectionEnd)
        const created = parts.map((p) => ({ ...p, id: newLineId() }))
        const first = created[0] as EditorLine
        const last = created[created.length - 1] as EditorLine
        // Text around the caret stays with the first and last pasted rows.
        const merged: EditorLine[] = [
            { ...line, text: `${before}${first.text}`, heading: before ? line.heading : first.heading },
            ...created.slice(1, -1),
            { ...last, text: `${last.text}${after}` },
        ]
        focusLater(last.id, last.text.length)
        onChange((prev) => {
            const at = prev.findIndex((l) => l.id === line.id)
            if (at < 0) return prev
            const next = prev.slice()
            next.splice(at, 1, ...merged)
            return next
        })
        setAnnouncement(`${created.length} rows added`)
    }

    // Pointer reordering. Rows shift with CSS transforms while dragging; React state
    // changes once on drop, then the dropped row settles from where it was let go.
    function onHandlePointerDown(event: ReactPointerEvent<HTMLButtonElement>, index: number) {
        if (event.button !== 0 || !event.isPrimary || drag.current) return
        const line = lines[index]
        const list = listRef.current
        if (!line || !list) return
        event.preventDefault()
        const items = lines.map((l) => rows.current.get(l.id)).filter((el): el is HTMLLIElement => Boolean(el))
        if (items.length !== lines.length) return
        const scrollY = window.scrollY
        const rects = items.map((el) => el.getBoundingClientRect())
        const gap = rects.length > 1 ? (rects[1]?.top ?? 0) - (rects[0]?.bottom ?? 0) : 0
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = {
            id: line.id,
            pointerId: event.pointerId,
            from: index,
            to: index,
            startPageY: event.clientY + scrollY,
            lastClientY: event.clientY,
            tops: rects.map((r) => r.top + scrollY),
            heights: rects.map((r) => r.height),
            gap,
            frame: 0,
            rows: items,
        }
        list.dataset.sorting = ''
        items[index]?.setAttribute('data-dragging', '')
        drag.current.frame = requestAnimationFrame(autoScroll)
    }

    function layout() {
        const d = drag.current
        if (!d) return
        const dy = d.lastClientY + window.scrollY - d.startPageY
        const fromTop = d.tops[d.from] ?? 0
        const height = d.heights[d.from] ?? 0
        const center = fromTop + dy + height / 2
        let to = d.from
        for (let i = 0; i < d.tops.length; i++) {
            if (i === d.from) continue
            const mid = (d.tops[i] ?? 0) + (d.heights[i] ?? 0) / 2
            if (i < d.from && center < mid) {
                to = Math.min(to, i)
            } else if (i > d.from && center > mid) {
                to = Math.max(to, i)
            }
        }
        d.to = to
        const shift = height + d.gap
        d.rows.forEach((row, i) => {
            if (i === d.from) {
                row.style.transform = `translateY(${dy}px)`
                return
            }
            let offset = 0
            if (d.from < to && i > d.from && i <= to) offset = -shift
            if (to < d.from && i >= to && i < d.from) offset = shift
            row.style.transform = offset ? `translateY(${offset}px)` : ''
        })
    }

    function autoScroll() {
        const d = drag.current
        if (!d) return
        const y = d.lastClientY
        let speed = 0
        if (y < EDGE) speed = -Math.ceil(((EDGE - y) / EDGE) * 14)
        else if (y > window.innerHeight - EDGE) speed = Math.ceil(((y - (window.innerHeight - EDGE)) / EDGE) * 14)
        if (speed) {
            window.scrollBy(0, speed)
            layout()
        }
        d.frame = requestAnimationFrame(autoScroll)
    }

    function onHandlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
        const d = drag.current
        if (!d || event.pointerId !== d.pointerId) return
        d.lastClientY = event.clientY
        layout()
    }

    function endDrag(commit: boolean) {
        const d = drag.current
        if (!d) return
        drag.current = null
        cancelAnimationFrame(d.frame)
        delete listRef.current?.dataset.sorting
        const dragged = d.rows[d.from]
        dragged?.removeAttribute('data-dragging')
        if (!commit || d.to === d.from) {
            // Everything springs back to its slot.
            for (const row of d.rows) row.style.transform = ''
            return
        }
        const visualTop = dragged?.getBoundingClientRect().top ?? 0
        for (const row of d.rows) {
            row.style.transition = 'none'
            row.style.transform = ''
        }
        const to = d.to
        flushSync(() => onChange((prev) => move(prev, d.from, to)))
        if (dragged) {
            const settle = visualTop - dragged.getBoundingClientRect().top
            dragged.style.transform = `translateY(${settle}px)`
            dragged.getBoundingClientRect()
        }
        for (const row of d.rows) row.style.transition = ''
        if (dragged) dragged.style.transform = ''
        setAnnouncement(`Moved to position ${to + 1} of ${count}`)
    }

    function onHandleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number, id: string) {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
        event.preventDefault()
        const to = index + (event.key === 'ArrowUp' ? -1 : 1)
        if (to < 0 || to >= count) return
        onChange((prev) => move(prev, index, to))
        setAnnouncement(`Moved to position ${to + 1} of ${count}`)
        requestAnimationFrame(() => rows.current.get(id)?.querySelector<HTMLButtonElement>('[data-handle]')?.focus())
    }

    useEffect(() => {
        const cancel = () => endDrag(false)
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Escape' && drag.current) {
                e.preventDefault()
                cancel()
            }
        }
        window.addEventListener('blur', cancel)
        window.addEventListener('keydown', onKey, true)
        return () => {
            window.removeEventListener('blur', cancel)
            window.removeEventListener('keydown', onKey, true)
        }
    })

    return (
        <section className={styles.section} aria-labelledby={titleId} data-kind={kind}>
            <h2 id={titleId} className={styles.title}>
                {copy.title}
            </h2>
            <VisuallyHidden id={hintId}>
                Drag, or press Up and Down arrows, to reorder. In a row, Alt plus Up or Down moves it.
            </VisuallyHidden>
            {count > 0 && (
                <ol ref={listRef} className={styles.list}>
                    {lines.map((line, index) => {
                        const n = numbers[index] ?? 0
                        const name = line.heading ? 'Section heading' : `${copy.one} ${n}`
                        return (
                            <li
                                key={line.id}
                                ref={(el) => {
                                    if (el) rows.current.set(line.id, el)
                                    else rows.current.delete(line.id)
                                }}
                                className={styles.row}
                                data-heading={line.heading || undefined}
                            >
                                <button
                                    type="button"
                                    data-handle=""
                                    className={styles.handle}
                                    aria-label={`Move ${name.toLowerCase()}`}
                                    aria-describedby={hintId}
                                    onPointerDown={(e) => onHandlePointerDown(e, index)}
                                    onPointerMove={onHandlePointerMove}
                                    onPointerUp={(e) => {
                                        if (drag.current?.pointerId === e.pointerId) endDrag(true)
                                    }}
                                    onPointerCancel={() => endDrag(false)}
                                    onLostPointerCapture={() => endDrag(false)}
                                    onKeyDown={(e) => onHandleKeyDown(e, index, line.id)}
                                >
                                    {icons.drag}
                                </button>
                                {kind === 'step' && !line.heading && (
                                    <span className={styles.number} aria-hidden>
                                        {n}
                                    </span>
                                )}
                                <textarea
                                    ref={(el) => {
                                        if (el) {
                                            inputs.current.set(line.id, el)
                                            autoGrow(el)
                                        } else inputs.current.delete(line.id)
                                    }}
                                    className={styles.input}
                                    rows={1}
                                    value={line.text}
                                    aria-label={name}
                                    aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                                    placeholder={
                                        line.heading ? 'Section' : kind === 'step' ? 'Describe the step' : 'Ingredient'
                                    }
                                    enterKeyHint="next"
                                    spellCheck
                                    maxLength={2000}
                                    onChange={(e) => {
                                        autoGrow(e.currentTarget)
                                        update(line.id, { text: e.currentTarget.value.replace(/\r?\n/g, ' ') })
                                    }}
                                    onKeyDown={(e) => onKeyDown(e, index)}
                                    onPaste={(e) => onPaste(e, index)}
                                />
                                <Menu>
                                    <MenuTrigger
                                        render={
                                            <IconButton
                                                className={styles.more}
                                                label={`${name} options`}
                                                icon={icons.more}
                                            />
                                        }
                                    />
                                    <MenuContent align="end">
                                        <MenuItem
                                            icon={line.heading ? icons[kind] : icons.heading}
                                            onClick={() => update(line.id, { heading: !line.heading })}
                                        >
                                            {line.heading ? `Make ${copy.one.toLowerCase()}` : 'Make heading'}
                                        </MenuItem>
                                        <MenuItem
                                            icon={icons.up}
                                            disabled={index === 0}
                                            onClick={() => moveBy(index, -1)}
                                        >
                                            Move up
                                        </MenuItem>
                                        <MenuItem
                                            icon={icons.down}
                                            disabled={index === count - 1}
                                            onClick={() => moveBy(index, 1)}
                                        >
                                            Move down
                                        </MenuItem>
                                        <MenuSeparator />
                                        <MenuItem icon={icons.delete} onClick={() => remove(index, true)}>
                                            Delete
                                        </MenuItem>
                                    </MenuContent>
                                </Menu>
                            </li>
                        )
                    })}
                </ol>
            )}
            <div className={styles.footer}>
                <Button variant="text" size="s" icon={icons.add} onClick={add} disabled={count >= 300}>
                    {copy.add}
                </Button>
            </div>
            <div className={styles.status} aria-live="polite">
                {announcement}
            </div>
        </section>
    )
}
