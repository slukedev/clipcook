'use client'

import type { ReactNode } from 'react'
import { IconButton } from '@/components/ui/icon-button'
import styles from './search-suggestions.module.scss'

interface SearchSuggestionsProps {
    recent: string[]
    icon: ReactNode
    removeIcon: ReactNode
    onPick: (query: string) => void
    onForget: (query: string) => void
}

/** Recent searches under the focused, empty search bar, as in a docked M3 search view. */
export function SearchSuggestions({ recent, icon, removeIcon, onPick, onForget }: SearchSuggestionsProps) {
    return (
        <div className={styles.panel}>
            <ul className={styles.list} aria-label="Recent searches">
                {recent.map((query) => (
                    <li key={query} className={styles.item}>
                        <button type="button" className={styles.pick} onClick={() => onPick(query)}>
                            <span className={styles.icon}>{icon}</span>
                            <span className={styles.text}>{query}</span>
                        </button>
                        <IconButton
                            className={styles.forget}
                            label={`Remove ${query}`}
                            icon={removeIcon}
                            onClick={() => onForget(query)}
                        />
                    </li>
                ))}
            </ul>
        </div>
    )
}
