/** Shared by the server reader, the client hook and the pre-paint script. */
export const THEME_COOKIE = 'clipcook_theme'
export const CONTRAST_COOKIE = 'clipcook_contrast'

export const THEMES = ['system', 'light', 'dark'] as const
export const CONTRASTS = ['standard', 'medium', 'high'] as const

export type ThemeMode = (typeof THEMES)[number]
export type Contrast = (typeof CONTRASTS)[number]
export type ResolvedTheme = 'light' | 'dark'

export interface ThemePreference {
    theme: ThemeMode
    contrast: Contrast
}

/** MCU contrast levels: 0 standard, 0.5 medium, 1 high. */
export const CONTRAST_LEVEL: Record<Contrast, number> = { standard: 0, medium: 0.5, high: 1 }

export function parseTheme(value: string | undefined | null): ThemeMode {
    return value === 'light' || value === 'dark' ? value : 'system'
}

export function parseContrast(value: string | undefined | null): Contrast {
    return value === 'medium' || value === 'high' ? value : 'standard'
}

export const COOKIE_MAX_AGE = 60 * 60 * 24 * 400
