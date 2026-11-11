import 'server-only'
import { cookies } from 'next/headers'
import {
    CONTRAST_COOKIE,
    MOTION_COOKIE,
    parseContrast,
    parseMotion,
    parseTheme,
    THEME_COOKIE,
    type ThemePreference,
} from './preference'

/** The viewer's saved appearance, for SSR attributes and per-recipe dynamic color. */
export async function getThemePreference(): Promise<ThemePreference> {
    const jar = await cookies()
    return {
        theme: parseTheme(jar.get(THEME_COOKIE)?.value),
        contrast: parseContrast(jar.get(CONTRAST_COOKIE)?.value),
        motion: parseMotion(jar.get(MOTION_COOKIE)?.value),
    }
}
