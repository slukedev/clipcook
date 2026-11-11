'use client'

import { Dialog } from '@base-ui/react/dialog'
import { Popover } from '@base-ui/react/popover'
import { type ReactNode, useRef, useState, useSyncExternalStore } from 'react'
import { cx } from '../cx'
import { IconButton } from '../icon-button/icon-button'
import { Glyph } from '../icon/glyph'
import { Ripple } from '../ripple/ripple'
import styles from './search.module.scss'

const EXPANDED = '(width >= 840px)'

function useExpanded() {
    return useSyncExternalStore(
        (onChange) => {
            const query = window.matchMedia(EXPANDED)
            query.addEventListener('change', onChange)
            return () => query.removeEventListener('change', onChange)
        },
        () => window.matchMedia(EXPANDED).matches,
        () => false,
    )
}

export interface SearchBarProps {
    value: string
    onValueChange: (value: string) => void
    onSubmit?: (value: string) => void
    placeholder?: string
    /** Replaces the search glyph (menu or back button). */
    leading?: ReactNode
    /** Up to two actions or an avatar. */
    trailing?: ReactNode
    /** Accessible name for the input. */
    label?: string
    className?: string
}

/** A plain inline search field in the M3 bar shape (filter-as-you-type lists). */
export function SearchBar({ value, onValueChange, onSubmit, placeholder = 'Search', leading, trailing, label, className }: SearchBarProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    return (
        <form
            role="search"
            className={cx(styles.bar, className)}
            onSubmit={(event) => {
                event.preventDefault()
                onSubmit?.(value)
            }}
        >
            <span className={styles.leading}>{leading ?? <Glyph name="search" />}</span>
            <input
                ref={inputRef}
                type="search"
                className={styles.input}
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                placeholder={placeholder}
                aria-label={label ?? placeholder}
                enterKeyHint="search"
            />
            <span className={styles.trailing}>
                {value ? (
                    <IconButton
                        label="Clear"
                        icon={<Glyph name="close" />}
                        onClick={() => {
                            onValueChange('')
                            inputRef.current?.focus()
                        }}
                    />
                ) : (
                    trailing
                )}
            </span>
        </form>
    )
}

export interface SearchProps {
    value: string
    onValueChange: (value: string) => void
    /** Enter in the view; closes it. */
    onSubmit?: (value: string) => void
    placeholder?: string
    leading?: ReactNode
    trailing?: ReactNode
    /** Suggestions and results shown in the open view. */
    children?: ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    className?: string
}

/**
 * Search bar that opens a search view: full screen on compact and medium windows,
 * docked under the bar on expanded and larger ones.
 */
export function Search({
    value,
    onValueChange,
    onSubmit,
    placeholder = 'Search',
    leading,
    trailing,
    children,
    open: controlledOpen,
    onOpenChange,
    className,
}: SearchProps) {
    const [uncontrolled, setUncontrolled] = useState(false)
    const open = controlledOpen ?? uncontrolled
    const setOpen = (next: boolean) => {
        setUncontrolled(next)
        onOpenChange?.(next)
    }
    const expanded = useExpanded()
    const [barTop, setBarTop] = useState<number>()
    const inputRef = useRef<HTMLInputElement>(null)

    const field = (
        <input
            ref={inputRef}
            type="search"
            className={styles.input}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    onSubmit?.(value)
                    setOpen(false)
                }
            }}
            placeholder={placeholder}
            aria-label={placeholder}
            enterKeyHint="search"
        />
    )
    const clear = value ? (
        <IconButton
            label="Clear"
            icon={<Glyph name="close" />}
            onClick={() => {
                onValueChange('')
                inputRef.current?.focus()
            }}
        />
    ) : null

    const bar = (
        <button
            type="button"
            className={cx(styles.bar, className)}
            onClick={(event) => {
                setBarTop(event.currentTarget.getBoundingClientRect().top)
                setOpen(true)
            }}
            aria-haspopup="dialog"
            aria-expanded={open}
        >
            <Ripple />
            <span className={styles.leading}>{leading ?? <Glyph name="search" />}</span>
            <span className={styles.placeholder} data-has-value={value ? '' : undefined}>
                {value || placeholder}
            </span>
            {trailing && <span className={styles.trailing}>{trailing}</span>}
        </button>
    )

    if (expanded) {
        return (
            <Popover.Root open={open} onOpenChange={setOpen}>
                <Popover.Trigger render={bar} nativeButton />
                <Popover.Portal>
                    <Popover.Positioner className={styles.positioner} side="bottom" align="start" sideOffset={-56}>
                        <Popover.Popup className={styles.docked} initialFocus={inputRef}>
                            <div className={styles.header}>
                                <Glyph name="search" />
                                {field}
                                {clear}
                            </div>
                            <div className={styles.divider} />
                            <div className={styles.results}>{children}</div>
                        </Popover.Popup>
                    </Popover.Positioner>
                </Popover.Portal>
            </Popover.Root>
        )
    }

    return (
        <>
            {bar}
            <Dialog.Root open={open} onOpenChange={setOpen}>
                <Dialog.Portal>
                    <Dialog.Popup
                        className={styles.full}
                        initialFocus={inputRef}
                        style={barTop !== undefined ? ({ '--_bar-top': `${barTop}px` } as React.CSSProperties) : undefined}
                    >
                        <Dialog.Title render={<span hidden />}>{placeholder}</Dialog.Title>
                        <div className={styles.header}>
                            <Dialog.Close render={<IconButton label="Back" icon={<Glyph name="arrow_back" />} />} />
                            {field}
                            {clear}
                        </div>
                        <div className={styles.divider} />
                        <div className={styles.results}>{children}</div>
                    </Dialog.Popup>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    )
}
