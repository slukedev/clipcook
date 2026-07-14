'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { THEME_COOKIE, parseThemePreference, type ResolvedTheme, type ThemePreference } from '@/lib/theme/preference'

interface ThemeContextValue {
    preference: ThemePreference
    setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readCookiePreference(): ThemePreference {
    const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`))
    return parseThemePreference(match?.[1])
}

function systemTheme(): ResolvedTheme {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: ResolvedTheme) {
    document.documentElement.dataset.theme = theme
    // Keep the browser chrome (address bar, title bar) matched to the surface.
    const surface = getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-surface').trim()
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])')
    if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'theme-color'
        document.head.appendChild(meta)
    }
    if (surface) meta.content = surface
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // The cookie is only readable on the client; SSR renders with 'system' and
    // the pre-paint script in the root layout has already set data-theme, so
    // nothing visual depends on this value until the user opens the toggle.
    const [preference, setPreferenceState] = useState<ThemePreference>('system')

    useEffect(() => {
        setPreferenceState(readCookiePreference())
    }, [])

    // Track OS scheme changes while in system mode.
    useEffect(() => {
        if (preference !== 'system') return
        const query = window.matchMedia('(prefers-color-scheme: dark)')
        const onChange = () => applyTheme(systemTheme())
        query.addEventListener('change', onChange)
        return () => query.removeEventListener('change', onChange)
    }, [preference])

    const setPreference = useCallback((next: ThemePreference) => {
        setPreferenceState(next)
        // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is async and not yet universal
        document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
        applyTheme(next === 'system' ? systemTheme() : next)
    }, [])

    return <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext)
    if (!context) throw new Error('useTheme must be used within ThemeProvider')
    return context
}
