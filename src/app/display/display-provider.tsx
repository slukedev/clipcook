'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createContext, type ReactNode, use, useEffect, useRef, useState } from 'react'
import type { DisplayState } from '@/lib/domain/types'
import { CornerMenu, type CornerMenuIcons } from './corner-menu'

interface DisplayContextValue {
    paired: boolean
    /** Latest state from the server; null until the first poll lands. */
    state: DisplayState | null
    unlink: () => Promise<void>
}

const DisplayContext = createContext<DisplayContextValue>({
    paired: false,
    state: null,
    unlink: async () => {},
})

export const useDisplay = () => use(DisplayContext)

const POLL_MS = 2000
const MAX_BACKOFF_MS = 30_000
const VERSION_KEY = 'clipcook.display.version'

function readAppliedVersion(): number | null {
    try {
        const raw = sessionStorage.getItem(VERSION_KEY)
        return raw ? Number(raw) : null
    } catch {
        return null
    }
}

function writeAppliedVersion(version: number) {
    try {
        sessionStorage.setItem(VERSION_KEY, String(version))
    } catch {
        // Private mode: a reload may re-apply the current state, which is harmless.
    }
}

/**
 * Polls the display's state while the page is visible (ETag, so most polls are a
 * bodiless 304), follows what the phone sends, and returns to pairing on a 401.
 * A newer version from the phone always wins over local taps on the display.
 */
export function DisplayProvider({
    paired,
    icons,
    children,
}: {
    paired: boolean
    icons: CornerMenuIcons
    children: ReactNode
}) {
    const router = useRouter()
    const pathname = usePathname()
    const [state, setState] = useState<DisplayState | null>(null)
    const pathRef = useRef(pathname)
    useEffect(() => {
        pathRef.current = pathname
    }, [pathname])

    useEffect(() => {
        if (!paired) return
        let etag: string | null = null
        let delay = POLL_MS
        let timer: ReturnType<typeof setTimeout> | undefined
        let stopped = false
        let inFlight: AbortController | null = null

        const schedule = () => {
            clearTimeout(timer)
            if (!stopped && document.visibilityState === 'visible') timer = setTimeout(poll, delay)
        }

        async function poll() {
            if (stopped || inFlight) return
            inFlight = new AbortController()
            try {
                const res = await fetch('/api/display/state', {
                    headers: etag ? { 'If-None-Match': etag } : {},
                    cache: 'no-store',
                    signal: inFlight.signal,
                })
                if (res.status === 401) {
                    stopped = true
                    router.replace('/display')
                    router.refresh()
                    return
                }
                if (res.status === 304) {
                    delay = POLL_MS
                } else if (res.ok) {
                    etag = res.headers.get('ETag')
                    setState((await res.json()) as DisplayState)
                    delay = POLL_MS
                } else {
                    const retryAfter = Number(res.headers.get('Retry-After'))
                    delay = retryAfter > 0 ? retryAfter * 1000 : Math.min(delay * 2, MAX_BACKOFF_MS)
                }
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return
                delay = Math.min(delay * 2, MAX_BACKOFF_MS)
            } finally {
                inFlight = null
            }
            schedule()
        }

        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                delay = POLL_MS
                void poll()
            } else {
                clearTimeout(timer)
            }
        }

        void poll()
        document.addEventListener('visibilitychange', onVisibility)
        window.addEventListener('online', onVisibility)
        return () => {
            stopped = true
            clearTimeout(timer)
            inFlight?.abort()
            document.removeEventListener('visibilitychange', onVisibility)
            window.removeEventListener('online', onVisibility)
        }
    }, [paired, router])

    // Follow the phone: open what it sent, or go home when it cleared the screen.
    useEffect(() => {
        if (!state) return
        const applied = readAppliedVersion()
        if (applied === state.version) return
        writeAppliedVersion(state.version)
        const target = state.current ? `/display/r/${state.current.recipeId}` : '/display'
        // A fresh page with nothing sent keeps whatever the household opened by touch.
        if (applied === null && !state.current) return
        if (pathRef.current.startsWith('/display/cast')) return
        if (pathRef.current !== target) router.replace(target)
    }, [state, router])

    useScreenWakeLock()

    async function unlink() {
        try {
            await fetch('/api/display/session', { method: 'DELETE' })
        } finally {
            try {
                sessionStorage.removeItem(VERSION_KEY)
            } catch {}
            router.replace('/display')
            router.refresh()
        }
    }

    return (
        <DisplayContext value={{ paired, state, unlink }}>
            {children}
            <CornerMenu icons={icons} paired={paired} onUnlink={unlink} />
        </DisplayContext>
    )
}

/** A kitchen display that falls asleep mid-recipe is useless; hold the screen on while visible. */
function useScreenWakeLock() {
    useEffect(() => {
        if (!('wakeLock' in navigator)) return
        let lock: WakeLockSentinel | null = null
        let cancelled = false
        const request = async () => {
            if (document.visibilityState !== 'visible' || lock) return
            try {
                const next = await navigator.wakeLock.request('screen')
                if (cancelled) {
                    void next.release()
                    return
                }
                lock = next
                next.addEventListener('release', () => {
                    if (lock === next) lock = null
                })
            } catch {
                // Not allowed here (no user gesture yet, or battery saver); try again on the next visit.
            }
        }
        void request()
        document.addEventListener('visibilitychange', request)
        // Some browsers only grant the lock after a gesture.
        document.addEventListener('pointerdown', request, { once: true })
        return () => {
            cancelled = true
            document.removeEventListener('visibilitychange', request)
            document.removeEventListener('pointerdown', request)
            void lock?.release()
        }
    }, [])
}
