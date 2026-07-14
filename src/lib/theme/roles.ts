/**
 * The Material 3 color roles ClipCook uses, mapped to their
 * `--md-sys-color-*` custom-property suffixes.
 *
 * Shared by the build-time theme generator (scripts/generate-theme.mjs)
 * and the runtime per-recipe scheme generator (src/lib/theme/scheme.ts)
 * so both always emit the same set of variables.
 */
export const COLOR_ROLES = [
    ['primary', 'primary'],
    ['onPrimary', 'on-primary'],
    ['primaryContainer', 'primary-container'],
    ['onPrimaryContainer', 'on-primary-container'],
    ['secondary', 'secondary'],
    ['onSecondary', 'on-secondary'],
    ['secondaryContainer', 'secondary-container'],
    ['onSecondaryContainer', 'on-secondary-container'],
    ['tertiary', 'tertiary'],
    ['onTertiary', 'on-tertiary'],
    ['tertiaryContainer', 'tertiary-container'],
    ['onTertiaryContainer', 'on-tertiary-container'],
    ['error', 'error'],
    ['onError', 'on-error'],
    ['errorContainer', 'error-container'],
    ['onErrorContainer', 'on-error-container'],
    ['background', 'background'],
    ['onBackground', 'on-background'],
    ['surface', 'surface'],
    ['surfaceDim', 'surface-dim'],
    ['surfaceBright', 'surface-bright'],
    ['surfaceContainerLowest', 'surface-container-lowest'],
    ['surfaceContainerLow', 'surface-container-low'],
    ['surfaceContainer', 'surface-container'],
    ['surfaceContainerHigh', 'surface-container-high'],
    ['surfaceContainerHighest', 'surface-container-highest'],
    ['onSurface', 'on-surface'],
    ['surfaceVariant', 'surface-variant'],
    ['onSurfaceVariant', 'on-surface-variant'],
    ['outline', 'outline'],
    ['outlineVariant', 'outline-variant'],
    ['inverseSurface', 'inverse-surface'],
    ['inverseOnSurface', 'inverse-on-surface'],
    ['inversePrimary', 'inverse-primary'],
    ['shadow', 'shadow'],
    ['scrim', 'scrim'],
    ['surfaceTint', 'surface-tint'],
    ['primaryFixed', 'primary-fixed'],
    ['primaryFixedDim', 'primary-fixed-dim'],
    ['onPrimaryFixed', 'on-primary-fixed'],
    ['onPrimaryFixedVariant', 'on-primary-fixed-variant'],
    ['secondaryFixed', 'secondary-fixed'],
    ['secondaryFixedDim', 'secondary-fixed-dim'],
    ['onSecondaryFixed', 'on-secondary-fixed'],
    ['onSecondaryFixedVariant', 'on-secondary-fixed-variant'],
    ['tertiaryFixed', 'tertiary-fixed'],
    ['tertiaryFixedDim', 'tertiary-fixed-dim'],
    ['onTertiaryFixed', 'on-tertiary-fixed'],
    ['onTertiaryFixedVariant', 'on-tertiary-fixed-variant'],
] as const

export type ColorRoleKey = (typeof COLOR_ROLES)[number][0]
