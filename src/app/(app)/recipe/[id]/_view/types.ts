import type { DisplayContent } from '@/lib/domain/types'

export interface DisplayOption {
    id: string
    name: string
    current: DisplayContent | null
    lastSeenAt: number | null
    /** Title of what it shows now, with the step when it follows one. */
    showing: string | null
}

export interface CollectionOption {
    id: string
    name: string
}
