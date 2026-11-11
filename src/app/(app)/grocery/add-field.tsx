'use client'

import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from 'react'
import { ChipSet, SuggestionChip } from '@/components/ui/chip'
import { IconButton } from '@/components/ui/icon-button'
import styles from './grocery.module.scss'
import type { PastItem } from './history'

/**
 * Always-on add field. Enter adds one item; pasting several lines adds them all.
 * While it has focus, things bought before sit under it as one-tap chips.
 */
export function AddField({
    onAdd,
    suggest,
    addIcon,
    submitIcon,
}: {
    onAdd: (lines: string[]) => void
    suggest: (query: string) => PastItem[]
    addIcon: ReactNode
    submitIcon: ReactNode
}) {
    const [value, setValue] = useState('')
    const [focused, setFocused] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const listId = useId()
    const pressing = usePressing()

    function submit() {
        if (!value.trim()) return
        onAdd([value])
        setValue('')
        inputRef.current?.focus()
    }

    // Rendered while closed too, so the row folds away with its chips instead of emptying first.
    const offers = suggest(value)
    const open = focused && offers.length > 0

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: focus tracking only; the field and chips inside are the controls
        <div
            className={styles.addArea}
            onFocus={() => setFocused(true)}
            onBlur={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                // Folding the chips moves the list up. If a press moved focus away, wait for it to
                // finish, or the release lands on a different row than the one pressed.
                if (pressing.current) {
                    const fold = () => setFocused(false)
                    window.addEventListener('click', fold, { once: true })
                    window.addEventListener('pointercancel', fold, { once: true })
                } else setFocused(false)
            }}
        >
            <form
                className={styles.add}
                onSubmit={(event) => {
                    event.preventDefault()
                    submit()
                }}
            >
                <span className={styles.addIcon} aria-hidden>
                    {addIcon}
                </span>
                <input
                    ref={inputRef}
                    className={styles.addInput}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape' && value) {
                            event.preventDefault()
                            setValue('')
                        }
                    }}
                    onPaste={(event) => {
                        const text = event.clipboardData.getData('text')
                        if (!/\r?\n/.test(text.trim())) return
                        event.preventDefault()
                        const lines = text.split(/\r?\n/)
                        if (value.trim()) lines.unshift(value)
                        onAdd(lines)
                        setValue('')
                    }}
                    placeholder="Add item"
                    aria-label="Add item"
                    aria-controls={open ? listId : undefined}
                    autoComplete="off"
                    autoCapitalize="sentences"
                    enterKeyHint="done"
                    maxLength={2000}
                />
                <IconButton
                    type="submit"
                    className={styles.addSubmit}
                    data-visible={value.trim() ? '' : undefined}
                    label="Add"
                    icon={submitIcon}
                    variant="filled"
                    size="s"
                    tabIndex={value.trim() ? 0 : -1}
                    aria-hidden={value.trim() ? undefined : true}
                />
            </form>
            <div className={styles.again} data-open={open || undefined} inert={!open}>
                <div className={styles.againInner}>
                    {offers.length > 0 && (
                        <ChipSet id={listId} scroll bleed label="Add again">
                            {offers.map((item) => (
                                <SuggestionChip
                                    key={item.name}
                                    icon={addIcon}
                                    // Keeps focus (and the phone keyboard) in the field, so several go on in a row.
                                    onPointerDown={(event) => event.preventDefault()}
                                    onClick={() => {
                                        onAdd([item.label])
                                        setValue('')
                                    }}
                                >
                                    {item.label}
                                </SuggestionChip>
                            ))}
                        </ChipSet>
                    )}
                </div>
            </div>
        </div>
    )
}

/** Whether a pointer is down anywhere on the page right now. */
function usePressing(): RefObject<boolean> {
    const pressing = useRef(false)
    useEffect(() => {
        const down = () => {
            pressing.current = true
        }
        const up = () => {
            pressing.current = false
        }
        window.addEventListener('pointerdown', down, true)
        window.addEventListener('pointerup', up, true)
        window.addEventListener('pointercancel', up, true)
        return () => {
            window.removeEventListener('pointerdown', down, true)
            window.removeEventListener('pointerup', up, true)
            window.removeEventListener('pointercancel', up, true)
        }
    }, [])
    return pressing
}
