import { argbFromHex } from '@material/material-color-utilities'

/** ARGB int (as stored on recipe docs) or a `#rrggbb` string. */
export type Seed = number | string

/**
 * Brand seed: paprika. Picked from ten tomato to saffron candidates rendered with
 * TonalSpot 2025 in light and dark. Redder seeds drift pink in the surfaces and
 * oranger ones turn the tertiary green; this one keeps a warm terracotta primary
 * and a saffron tertiary.
 */
export const BRAND_SEED = '#C2502A'

export function parseSeed(seed: Seed): number {
    if (typeof seed === 'number') return seed >>> 0
    return argbFromHex(seed)
}

/** ARGB int to `#rrggbb`. */
export function seedToHex(argb: number): string {
    return `#${(argb & 0xffffff).toString(16).padStart(6, '0')}`
}
