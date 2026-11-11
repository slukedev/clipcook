// Small per-device preferences. Cookies when the server must render them (no layout
// shift on load), localStorage when only the client needs them.

export const RAIL_COOKIE = 'clipcook_rail'
export const MOTION_KEY = 'clipcook_motion'

export type MotionPreference = 'expressive' | 'standard'

const YEAR = 60 * 60 * 24 * 400

export function writeCookie(name: string, value: string) {
    // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is async and not universal yet
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${YEAR}; samesite=lax`
}

export function readMotion(): MotionPreference {
    try {
        return localStorage.getItem(MOTION_KEY) === 'standard' ? 'standard' : 'expressive'
    } catch {
        return 'expressive'
    }
}

export function applyMotion(value: MotionPreference) {
    const root = document.documentElement
    if (value === 'standard') root.dataset.motion = 'standard'
    else delete root.dataset.motion
}

export function saveMotion(value: MotionPreference) {
    try {
        if (value === 'standard') localStorage.setItem(MOTION_KEY, value)
        else localStorage.removeItem(MOTION_KEY)
    } catch {
        // Private mode: the choice lasts for this page only.
    }
    applyMotion(value)
}
