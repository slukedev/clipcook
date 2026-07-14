import { Hct, MaterialDynamicColors, SchemeTonalSpot, hexFromArgb } from '@material/material-color-utilities'
import { COLOR_ROLES } from './roles'

export type SchemeMap = Record<string, string>

/**
 * Generates the full set of M3 color roles for one scheme as a map of
 * `--md-sys-color-*` suffix → hex value, from a single ARGB seed color.
 *
 * Used at build time for the baseline theme (scripts/generate-theme.mjs)
 * and at request time for per-recipe dynamic color.
 */
export function schemeFromSeed(seedArgb: number, dark: boolean, contrastLevel = 0): SchemeMap {
    const scheme = new SchemeTonalSpot(Hct.fromInt(seedArgb), dark, contrastLevel)
    const out: SchemeMap = {}
    for (const [key, cssName] of COLOR_ROLES) {
        const dynamicColor = MaterialDynamicColors[key]
        out[cssName] = hexFromArgb(dynamicColor.getArgb(scheme))
    }
    return out
}

/**
 * Renders a scheme map as CSS custom-property declarations
 * (no selector), e.g. `--md-sys-color-primary: #65558f;`.
 */
export function schemeToCssDeclarations(scheme: SchemeMap, indent = ''): string {
    return Object.entries(scheme)
        .map(([name, hex]) => `${indent}--md-sys-color-${name}: ${hex};`)
        .join('\n')
}

/**
 * CSS for per-recipe dynamic color: scoped custom-property overrides for a
 * container selector, one block per app theme, generated from a seed color.
 * The variable names shadow the global theme inside the container only.
 */
export function dynamicColorCss(selector: string, seedArgb: number): string {
    const light = schemeFromSeed(seedArgb, false)
    const dark = schemeFromSeed(seedArgb, true)
    return [
        `[data-theme='light'] ${selector} {\n${schemeToCssDeclarations(light, '    ')}\n}`,
        `[data-theme='dark'] ${selector} {\n${schemeToCssDeclarations(dark, '    ')}\n}`,
    ].join('\n')
}
