'use client'

import { Combobox } from '@base-ui/react/combobox'
import { type KeyboardEvent, useId, useState } from 'react'
import { Glyph } from '@/components/ui/icon/glyph'
import type { EditorIcons } from './icons'
import styles from './tag-field.module.scss'

const MAX_TAGS = 20
const MAX_LENGTH = 40
const CREATE = '\u0001add:'

export function normalizeTag(value: string): string {
    return value.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, MAX_LENGTH)
}

interface TagFieldProps {
    value: string[]
    onChange: (tags: string[]) => void
    /** Every tag the cook already uses, most used first. */
    suggestions: string[]
    icons: EditorIcons
}

/** Input chips with autocomplete from existing tags; Enter or comma adds what was typed. */
export function TagField({ value, onChange, suggestions, icons }: TagFieldProps) {
    const id = useId()
    const [query, setQuery] = useState('')
    const typed = normalizeTag(query)
    const full = value.length >= MAX_TAGS

    const all = Array.from(new Set([...value, ...suggestions]))
    const matches = typed ? all.filter((t) => t.includes(typed)) : suggestions.filter((t) => !value.includes(t))
    const exact = matches.includes(typed)
    const ordered = exact ? [typed, ...matches.filter((t) => t !== typed)] : matches
    const shown = (typed && !exact && !full ? [`${CREATE}${typed}`, ...ordered] : ordered).slice(0, 8)

    function add(tag: string) {
        const t = normalizeTag(tag)
        if (!t || value.includes(t) || full) return
        onChange([...value, t])
    }

    function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === ',' || (event.key === 'Tab' && typed && !event.shiftKey && !exact)) {
            if (!typed) return
            event.preventDefault()
            add(typed)
            setQuery('')
        }
    }

    return (
        <div className={styles.field}>
            <label className={styles.label} htmlFor={id}>
                <span className={styles.labelIcon}>{icons.tag}</span>
                Tags
            </label>
            <Combobox.Root
                items={shown}
                filteredItems={shown}
                filter={null}
                multiple
                autoHighlight
                value={value}
                onValueChange={(next) => {
                    const list = (Array.isArray(next) ? next : []) as string[]
                    const out: string[] = []
                    for (const item of list) {
                        const tag = normalizeTag(item.startsWith(CREATE) ? item.slice(CREATE.length) : item)
                        if (tag && !out.includes(tag)) out.push(tag)
                    }
                    onChange(out.slice(0, MAX_TAGS))
                    setQuery('')
                }}
                inputValue={query}
                onInputValueChange={(next) => setQuery(next.slice(0, MAX_LENGTH))}
            >
                <Combobox.InputGroup className={styles.group}>
                    <Combobox.Chips className={styles.chips} aria-label={value.length ? 'Tags' : undefined}>
                        {value.map((tag) => (
                            <Combobox.Chip
                                key={tag}
                                className={styles.chip}
                                aria-label={tag}
                                aria-description="Press Backspace to remove"
                            >
                                <span className={styles.chipText}>{tag}</span>
                                <Combobox.ChipRemove className={styles.chipRemove} aria-label={`Remove ${tag}`}>
                                    <Glyph name="close" size={18} />
                                </Combobox.ChipRemove>
                            </Combobox.Chip>
                        ))}
                        <Combobox.Input
                            id={id}
                            className={styles.input}
                            placeholder={value.length ? (full ? '' : 'Add tag') : 'dinner, vegetarian'}
                            disabled={full}
                            autoComplete="off"
                            enterKeyHint="done"
                            onKeyDown={onKeyDown}
                        />
                    </Combobox.Chips>
                </Combobox.InputGroup>
                <Combobox.Portal>
                    <Combobox.Positioner className={styles.positioner} sideOffset={4} collisionPadding={8}>
                        <Combobox.Popup className={styles.popup} hidden={shown.length === 0}>
                            <Combobox.List className={styles.list}>
                                {(item: string) => (
                                    <Combobox.Item key={item} value={item} className={styles.item}>
                                        {item.startsWith(CREATE) ? (
                                            <>
                                                <span className={styles.itemIcon}>{icons.add}</span>
                                                <span className={styles.itemText}>
                                                    Add “{item.slice(CREATE.length)}”
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <span className={styles.itemIcon}>
                                                    <Combobox.ItemIndicator>
                                                        <Glyph name="check" size={20} />
                                                    </Combobox.ItemIndicator>
                                                </span>
                                                <span className={styles.itemText}>{item}</span>
                                            </>
                                        )}
                                    </Combobox.Item>
                                )}
                            </Combobox.List>
                        </Combobox.Popup>
                    </Combobox.Positioner>
                </Combobox.Portal>
            </Combobox.Root>
        </div>
    )
}
