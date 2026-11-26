import { type SchemeOptions, schemeFromSeed } from '@/lib/theme/scheme'
import type { Seed } from '@/lib/theme/seed'

// Secondary text and outlines come from the medium contrast scheme: displays are read from
// across the kitchen on dim, low-density screens. Body text is already bright enough, and
// accents and fills keep the standard palette.
const LIFTED_ROLES = ['on-surface-variant', 'outline'] as const

/** A display's dark scheme, with brighter secondary text than the app's. */
export function displayScheme(seed: Seed, options: Omit<SchemeOptions, 'dark' | 'contrast'> = {}) {
    const base = schemeFromSeed(seed, { ...options, dark: true })
    const medium = schemeFromSeed(seed, { ...options, dark: true, contrast: 'medium' })
    for (const role of LIFTED_ROLES) {
        const value = medium[role]
        if (value) base[role] = value
    }
    return base
}
