import {
    DynamicScheme,
    Hct,
    hexFromArgb,
    MaterialDynamicColors,
    SchemeContent,
    SchemeExpressive,
    SchemeTonalSpot,
    SchemeVibrant,
    TonalPalette,
} from '@material/material-color-utilities'
import { type Contrast, CONTRAST_LEVEL } from './preference'
import { parseSeed, type Seed } from './seed'

/**
 * `tonalSpot` is the app chrome (Material's default). `content` keeps the
 * source color's own chroma and is used for recipe pages, where the photo
 * should set the mood. See src/lib/theme/README.md for why.
 */
export type SchemeVariant = 'tonalSpot' | 'content' | 'vibrant' | 'expressive'

export interface SchemeOptions {
    dark?: boolean
    contrast?: Contrast
    variant?: SchemeVariant
    /**
     * Overrides the primary palette's chroma while keeping the variant's tone
     * mapping, neutrals and accents. The brand uses it so TonalSpot's calm surfaces
     * sit under a primary that still reads as paprika instead of cocoa.
     */
    primaryChroma?: number
}

/** `--md-sys-color-*` suffix to `#rrggbb`. */
export type SchemeMap = Record<string, string>

// 2025 spec is honored for TonalSpot/Vibrant/Expressive; Content silently uses 2021.
const SPEC = '2025' as const

function buildScheme(seed: Seed, options: SchemeOptions): DynamicScheme {
    const base = baseScheme(seed, options)
    if (options.primaryChroma === undefined) return base
    return new DynamicScheme({
        sourceColorHct: base.sourceColorHct,
        variant: base.variant,
        contrastLevel: base.contrastLevel,
        isDark: base.isDark,
        specVersion: SPEC,
        primaryPalette: TonalPalette.fromHueAndChroma(base.primaryPalette.hue, options.primaryChroma),
        secondaryPalette: base.secondaryPalette,
        tertiaryPalette: base.tertiaryPalette,
        neutralPalette: base.neutralPalette,
        neutralVariantPalette: base.neutralVariantPalette,
        errorPalette: base.errorPalette,
    })
}

function baseScheme(seed: Seed, { dark = false, contrast = 'standard', variant = 'tonalSpot' }: SchemeOptions) {
    const hct = Hct.fromInt(parseSeed(seed))
    const level = CONTRAST_LEVEL[contrast]
    switch (variant) {
        case 'content':
            return new SchemeContent(hct, dark, level, SPEC)
        case 'vibrant':
            return new SchemeVibrant(hct, dark, level, SPEC)
        case 'expressive':
            return new SchemeExpressive(hct, dark, level, SPEC)
        default:
            return new SchemeTonalSpot(hct, dark, level, SPEC)
    }
}

const dynamicColors = new MaterialDynamicColors()

function toMap(scheme: DynamicScheme): SchemeMap {
    const out: SchemeMap = {}
    for (const color of dynamicColors.allColors) {
        // Key colors are generator inputs, not roles.
        if (color.name.endsWith('_palette_key_color')) continue
        out[color.name.replaceAll('_', '-')] = hexFromArgb(color.getArgb(scheme))
    }
    // Roles Compose still has that MCU 0.4 dropped from allColors.
    out['surface-variant'] = out['surface-container-highest'] ?? ''
    out['surface-tint'] = out.primary ?? ''
    out.shadow = '#000000'
    out.scrim = '#000000'
    return out
}

/** Every M3 color role for one seed, mode and contrast level. Server-safe, no DOM. */
export function schemeFromSeed(seed: Seed, options: SchemeOptions = {}): SchemeMap {
    return toMap(buildScheme(seed, options))
}

/** CSS custom-property declarations for a scheme map (no selector). */
export function schemeDeclarations(scheme: SchemeMap, indent = '    '): string {
    return Object.entries(scheme)
        .map(([name, hex]) => `${indent}--md-sys-color-${name}: ${hex};`)
        .join('\n')
}

/**
 * Scoped dynamic color for one container, following the same light/dark rules
 * as the global theme (system preference unless the user picked a mode).
 * Pass the viewer's contrast preference so only one contrast level ships.
 */
export function dynamicColorCss(
    selector: string,
    seed: Seed,
    { contrast = 'standard', variant = 'content' }: Omit<SchemeOptions, 'dark'> = {},
): string {
    const light = schemeDeclarations(schemeFromSeed(seed, { dark: false, contrast, variant }))
    const dark = schemeDeclarations(schemeFromSeed(seed, { dark: true, contrast, variant }), '        ')
    const darkFlat = dark.replaceAll('\n        ', '\n    ').replace(/^ {8}/, '    ')
    return [
        `${selector} {\n${light}\n}`,
        `@media (prefers-color-scheme: dark) {\n    :root:not([data-theme='light']) ${selector} {\n${dark}\n    }\n}`,
        `:root[data-theme='dark'] ${selector} {\n${darkFlat}\n}`,
    ].join('\n')
}
