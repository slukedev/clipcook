'use client'

import { createContext, use, useState, useSyncExternalStore } from 'react'
import {
    CONTRAST_COOKIE,
    COOKIE_MAX_AGE,
    type Contrast,
    MOTION_COOKIE,
    type MotionMode,
    type ResolvedTheme,
    THEME_COOKIE,
    type ThemeMode,
    type ThemePreference,
} from '@/lib/theme/preference'

interface ThemeContextValue extends ThemePreference {
    /** What is on screen now, after resolving `system`. */
    resolvedTheme: ResolvedTheme
    setTheme: (theme: ThemeMode) => void
    setContrast: (contrast: Contrast) => void
    /** Expressive or standard springs (`data-motion` on <html>). */
    setMotion: (motion: MotionMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const DARK_QUERY = '(prefers-color-scheme: dark)'

function subscribeSystem(onChange: () => void) {
    const query = window.matchMedia(DARK_QUERY)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
}

function writeCookie(name: string, value: string) {
    // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is async and not universal yet
    document.cookie = `${name}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
}

function syncThemeColor() {
    const surface = getComputedStyle(document.body).getPropertyValue('--md-sys-color-surface').trim()
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
        if (surface) meta.content = surface
    }
}

// Appearance changes crossfade instead of snapping every surface at once.
function withTransition(update: () => void) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduce) {
        update()
        syncThemeColor()
        return
    }
    // The whole root crossfades here, unlike route changes, which keep the chrome anchored.
    const root = document.documentElement
    root.dataset.vtRoot = 'theme'
    const done = () => {
        delete root.dataset.vtRoot
        syncThemeColor()
    }
    document.startViewTransition(update).finished.then(done, done)
}

function applyAttribute(name: 'theme' | 'contrast' | 'motion', value: string | undefined) {
    const root = document.documentElement
    if (value) root.dataset[name] = value
    else delete root.dataset[name]
}

/** Seeded from the server's cookie read so SSR and hydration agree. */
export function ThemeProvider({ initial, children }: { initial: ThemePreference; children: React.ReactNode }) {
    const [preference, setPreference] = useState(initial)
    const systemDark = useSyncExternalStore(
        subscribeSystem,
        () => window.matchMedia(DARK_QUERY).matches,
        () => false,
    )
    const resolvedTheme: ResolvedTheme =
        preference.theme === 'system' ? (systemDark ? 'dark' : 'light') : preference.theme

    const value: ThemeContextValue = {
        ...preference,
        resolvedTheme,
        setTheme(theme) {
            writeCookie(THEME_COOKIE, theme)
            withTransition(() => {
                applyAttribute('theme', theme === 'system' ? undefined : theme)
                setPreference((p) => ({ ...p, theme }))
            })
        },
        setContrast(contrast) {
            writeCookie(CONTRAST_COOKIE, contrast)
            withTransition(() => {
                applyAttribute('contrast', contrast === 'standard' ? undefined : contrast)
                setPreference((p) => ({ ...p, contrast }))
            })
        },
        setMotion(motion) {
            writeCookie(MOTION_COOKIE, motion)
            applyAttribute('motion', motion === 'standard' ? motion : undefined)
            setPreference((p) => ({ ...p, motion }))
        },
    }
    return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useThemePreference(): ThemeContextValue {
    const context = use(ThemeContext)
    if (!context) throw new Error('useThemePreference must be used inside <ThemeProvider>')
    return context
}
