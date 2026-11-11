'use client'

import { animate, motion, type PanInfo, useDragControls, useMotionValue, useTransform } from 'motion/react'
import { type ReactNode, useId, useRef, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { IconButton } from '@/components/ui/icon-button'
import type { GroceryItem } from '@/lib/domain/types'
import { spring, useReducedMotion } from '@/lib/motion'
import styles from './grocery.module.scss'

const LONG_PRESS_MS = 450
const MOVE_TOLERANCE = 8
/** px/ms; a flick faster than this dismisses regardless of distance. */
const DISMISS_VELOCITY = 0.11
const DISMISS_FRACTION = 0.4

interface RowProps {
    item: GroceryItem
    deleteIcon: ReactNode
    onToggle: (item: GroceryItem) => void
    onEdit: (item: GroceryItem, text: string) => void
    onDelete: (item: GroceryItem) => void
}

/**
 * One checkable row. The whole row toggles. Text opens the editor (click on desktop,
 * long-press on touch). On touch the row swipes away to delete.
 */
export function GroceryRow({ item, deleteIcon, onToggle, onEdit, onDelete }: RowProps) {
    const textId = useId()
    const [editing, setEditing] = useState(false)
    const pointerType = useRef<string>('')
    const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null)
    const longPressed = useRef(false)
    const rowRef = useRef<HTMLDivElement>(null)
    const reduce = useReducedMotion()

    const x = useMotionValue(0)
    const reveal = useTransform(x, (v) => Math.min(1, Math.abs(v) / 72))
    const controls = useDragControls()

    function cancelPress() {
        if (press.current) clearTimeout(press.current.timer)
        press.current = null
    }

    function onPointerDown(event: React.PointerEvent) {
        pointerType.current = event.pointerType
        longPressed.current = false
        if (event.pointerType !== 'touch' || editing) return
        if ((event.target as HTMLElement).closest('button:not([data-row-text]), input')) return
        controls.start(event)
        press.current = {
            x: event.clientX,
            y: event.clientY,
            timer: setTimeout(() => {
                press.current = null
                longPressed.current = true
                navigator.vibrate?.(10)
                setEditing(true)
            }, LONG_PRESS_MS),
        }
    }

    function onPointerMove(event: React.PointerEvent) {
        const p = press.current
        if (p && Math.hypot(event.clientX - p.x, event.clientY - p.y) > MOVE_TOLERANCE) cancelPress()
    }

    function onDragEnd(_: unknown, info: PanInfo) {
        const width = rowRef.current?.offsetWidth ?? 320
        const velocity = info.velocity.x / 1000
        const far = Math.abs(info.offset.x) > width * DISMISS_FRACTION
        const flung = Math.abs(velocity) > DISMISS_VELOCITY && Math.sign(velocity) === Math.sign(info.offset.x)
        if (far || flung) {
            const direction = Math.sign(info.offset.x || velocity) || 1
            animate(
                x,
                direction * width * 1.1,
                reduce ? { duration: 0 } : { ...spring.spatialFast, velocity: info.velocity.x },
            )
            setTimeout(() => onDelete(item), reduce ? 0 : 160)
        } else {
            animate(x, 0, reduce ? { duration: 0 } : { ...spring.spatialFast, velocity: info.velocity.x })
        }
    }

    function onRowClick(event: React.MouseEvent) {
        if (editing || longPressed.current) return
        if ((event.target as HTMLElement).closest('button, input, [role="checkbox"]')) return
        onToggle(item)
    }

    function onTextClick() {
        const type = pointerType.current
        pointerType.current = ''
        if (longPressed.current) return
        if (type === 'touch') onToggle(item)
        else setEditing(true)
    }

    return (
        <motion.li layout="position" className={styles.item} data-checked={item.checked || undefined}>
            <motion.span className={styles.swipeBackdrop} style={{ opacity: reveal }} aria-hidden>
                {deleteIcon}
                {deleteIcon}
            </motion.span>
            <motion.div
                ref={rowRef}
                className={styles.row}
                style={{ x }}
                drag={editing ? false : 'x'}
                dragListener={false}
                dragControls={controls}
                dragDirectionLock
                dragMomentum={false}
                onDragStart={cancelPress}
                onDragEnd={onDragEnd}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={cancelPress}
                onPointerCancel={cancelPress}
                onClick={onRowClick}
                onContextMenu={(event) => {
                    if (pointerType.current === 'touch') event.preventDefault()
                }}
            >
                <Checkbox
                    className={styles.check}
                    checked={item.checked}
                    onCheckedChange={() => onToggle(item)}
                    aria-labelledby={textId}
                />
                {editing ? (
                    <EditInput
                        initial={item.text}
                        onDone={(text) => {
                            setEditing(false)
                            if (text !== null) onEdit(item, text)
                        }}
                    />
                ) : (
                    <button
                        type="button"
                        className={styles.text}
                        data-row-text=""
                        onClick={onTextClick}
                        aria-label={`Edit ${item.text}`}
                    >
                        <span id={textId}>{item.text}</span>
                    </button>
                )}
                {!editing && (
                    <IconButton
                        className={styles.delete}
                        label={`Delete ${item.text}`}
                        icon={deleteIcon}
                        size="s"
                        onClick={() => onDelete(item)}
                    />
                )}
            </motion.div>
        </motion.li>
    )
}

function EditInput({ initial, onDone }: { initial: string; onDone: (text: string | null) => void }) {
    const [value, setValue] = useState(initial)
    const finished = useRef(false)
    const finish = (text: string | null) => {
        if (finished.current) return
        finished.current = true
        onDone(text)
    }
    return (
        <input
            className={styles.editInput}
            value={value}
            // biome-ignore lint/a11y/noAutofocus: the user asked to edit this row
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault()
                    finish(value)
                } else if (event.key === 'Escape') {
                    event.preventDefault()
                    finish(null)
                }
            }}
            onBlur={() => finish(value)}
            aria-label="Edit item"
            enterKeyHint="done"
            maxLength={2000}
        />
    )
}
