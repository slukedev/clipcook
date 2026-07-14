export const THEME_COOKIE = 'clipcook_theme'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export function parseThemePreference(value: string | undefined): ThemePreference {
    return value === 'light' || value === 'dark' ? value : 'system'
}
