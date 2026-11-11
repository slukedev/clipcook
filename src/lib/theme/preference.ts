/** Shared by the server reader, the client hook and the pre-paint script. */
export const THEME_COOKIE = 'clipcook_theme'
export const CONTRAST_COOKIE = 'clipcook_contrast'
export const MOTION_COOKIE = 'clipcook_motion'

export const THEMES = ['system', 'light', 'dark'] as const
export const CONTRASTS = ['standard', 'medium', 'high'] as const
export const MOTIONS = ['expressive', 'standard'] as const

export type ThemeMode = (typeof THEMES)[number]
export type Contrast = (typeof CONTRASTS)[number]
export type MotionMode = (typeof MOTIONS)[number]
export type ResolvedTheme = 'light' | 'dark'

export interface ThemePreference {
    theme: ThemeMode
    contrast: Contrast
    motion: MotionMode
}

/** MCU contrast levels: 0 standard, 0.5 medium, 1 high. */
export const CONTRAST_LEVEL: Record<Contrast, number> = { standard: 0, medium: 0.5, high: 1 }

export function parseTheme(value: string | undefined | null): ThemeMode {
    return value === 'light' || value === 'dark' ? value : 'system'
}

export function parseContrast(value: string | undefined | null): Contrast {
    return value === 'medium' || value === 'high' ? value : 'standard'
}

export function parseMotion(value: string | undefined | null): MotionMode {
    return value === 'standard' ? 'standard' : 'expressive'
}

export const COOKIE_MAX_AGE = 60 * 60 * 24 * 400
