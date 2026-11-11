import type { DisplayContent } from '@/lib/domain/types'

export interface DisplayOption {
    id: string
    name: string
    current: DisplayContent | null
}

export interface CollectionOption {
    id: string
    name: string
}
