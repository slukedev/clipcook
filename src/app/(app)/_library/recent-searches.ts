'use client'

import { useEffect, useState } from 'react'

const KEY = 'clipcook.recentSearches'
const MAX = 6

function read(): string[] {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
        return Array.isArray(parsed) ? parsed.filter((q): q is string => typeof q === 'string').slice(0, MAX) : []
    } catch {
        return []
    }
}

function write(list: string[]) {
    try {
        localStorage.setItem(KEY, JSON.stringify(list))
    } catch {
        // Private mode or blocked storage: recents are a convenience.
    }
}

/** The last few library searches on this device, newest first. */
export function useRecentSearches() {
    const [recent, setRecent] = useState<string[]>([])
    useEffect(() => setRecent(read()), [])

    const update = (next: string[]) => {
        setRecent(next)
        write(next)
    }
    const remember = (query: string) => {
        const q = query.trim().replace(/\s+/g, ' ')
        if (!q) return
        update([q, ...recent.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, MAX))
    }
    const forget = (query: string) => update(recent.filter((r) => r !== query))
    return { recent, remember, forget }
}
