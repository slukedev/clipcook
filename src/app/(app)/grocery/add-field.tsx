'use client'

import { type ReactNode, useRef, useState } from 'react'
import { IconButton } from '@/components/ui/icon-button'
import styles from './grocery.module.scss'

/** Always-on add field. Enter adds one item; pasting several lines adds them all. */
export function AddField({
    onAdd,
    addIcon,
    submitIcon,
}: {
    onAdd: (lines: string[]) => void
    addIcon: ReactNode
    submitIcon: ReactNode
}) {
    const [value, setValue] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    function submit() {
        if (!value.trim()) return
        onAdd([value])
        setValue('')
        inputRef.current?.focus()
    }

    return (
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
    )
}
