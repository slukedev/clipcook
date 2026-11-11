// Small per-device preferences, in cookies so the server renders them without a
// layout shift. Theme, contrast and motion live in @/lib/theme.

import { TIME_ZONE_COOKIE } from '@/lib/plan/week'

export const RAIL_COOKIE = 'clipcook_rail'
const LEGACY_MOTION_KEY = 'clipcook_motion'

const YEAR = 60 * 60 * 24 * 400

export function writeCookie(name: string, value: string) {
    // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is async and not universal yet
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${YEAR}; samesite=lax`
}

/**
 * Motion used to live in localStorage. Carry an old "standard" choice over to the
 * theme cookie once, so the pre-paint script can apply it from then on.
 */
export function takeLegacyMotion(): 'standard' | null {
    try {
        const value = localStorage.getItem(LEGACY_MOTION_KEY)
        if (value === null) return null
        localStorage.removeItem(LEGACY_MOTION_KEY)
        return value === 'standard' ? 'standard' : null
    } catch {
        return null
    }
}

export function readCookie(name: string): string | null {
    for (const part of document.cookie.split('; ')) {
        const eq = part.indexOf('=')
        if (part.slice(0, eq) !== name) continue
        try {
            return decodeURIComponent(part.slice(eq + 1))
        } catch {
            return null
        }
    }
    return null
}

/** Stores the browser's time zone when it changed (first visit, travel). True when it did. */
export function rememberTimeZone(): boolean {
    let zone: string
    try {
        zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
        return false
    }
    if (!zone || readCookie(TIME_ZONE_COOKIE) === zone) return false
    writeCookie(TIME_ZONE_COOKIE, zone)
    return true
}
