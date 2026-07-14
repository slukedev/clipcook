'use client'

import { cx } from '../cx'
import { Icon } from '../icon'
import { IconButton } from '../icon-button'
import styles from './search-bar.module.scss'

interface SearchBarProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    onSubmit?: () => void
    autoFocus?: boolean
    /** Rendered after the clear button (e.g. an avatar). */
    trailingSlot?: React.ReactNode
    inputRef?: React.Ref<HTMLInputElement>
    className?: string
}

/** M3 search bar: pill container on surface-container-high. */
export function SearchBar({
    value,
    onChange,
    placeholder = 'Search',
    onSubmit,
    autoFocus,
    trailingSlot,
    inputRef,
    className,
}: SearchBarProps) {
    return (
        <div className={cx(styles.bar, className)}>
            <Icon name="search" className={styles.searchIcon} />
            <input
                ref={inputRef}
                type="search"
                className={styles.input}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') onSubmit?.()
                    if (event.key === 'Escape') onChange('')
                }}
                placeholder={placeholder}
                aria-label={placeholder}
                // biome-ignore lint/a11y/noAutofocus: opt-in via prop for search-first screens
                autoFocus={autoFocus}
                autoComplete="off"
                spellCheck={false}
            />
            {value && <IconButton icon="close" label="Clear search" onClick={() => onChange('')} />}
            {trailingSlot && <span className={styles.trailing}>{trailingSlot}</span>}
        </div>
    )
}
