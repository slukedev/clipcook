import type { DisplayContent } from '@/lib/domain/types'

export interface DisplayOption {
    id: string
    name: string
    current: DisplayContent | null
    lastSeenAt: number | null
    /** online, offline (not seen for minutes), or unlinked (paired but its screen never collected the link). */
    presence: 'online' | 'offline' | 'unlinked'
    /** Title of what it shows now, with the step when it follows one. */
    showing: string | null
}

export interface CollectionOption {
    id: string
    name: string
}
