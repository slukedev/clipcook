import { argbFromHex } from '@material/material-color-utilities'

/** ARGB int (as stored on recipe docs) or a `#rrggbb` string. */
export type Seed = number | string

/**
 * Brand seed: paprika. Picked from tomato to saffron candidates rendered in light
 * and dark. Plain TonalSpot caps primary chroma near 32, which turns any red-orange
 * seed into cocoa brown; Vibrant fixes that but brings a purple tertiary and
 * blood-red dark surfaces. So the chrome is TonalSpot 2025 (calm warm neutrals,
 * saffron tertiary) with the primary palette held at chroma 60.
 */
export const BRAND_SEED = '#C2502A'
export const BRAND_PRIMARY_CHROMA = 60

export function parseSeed(seed: Seed): number {
    if (typeof seed === 'number') return seed >>> 0
    return argbFromHex(seed)
}

/** ARGB int to `#rrggbb`. */
export function seedToHex(argb: number): string {
    return `#${(argb & 0xffffff).toString(16).padStart(6, '0')}`
}
