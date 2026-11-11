'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
const noop = () => () => {}

function readFlag(key: string): boolean {
    try {
        return localStorage.getItem(key) === '1'
    } catch {
        return false
    }
}

/** A per-device on/off preference in localStorage. Off during SSR and when storage is blocked. */
export function useStoredFlag(key: string): [boolean, (value: boolean) => void] {
    const value = useSyncExternalStore(
        (onChange) => {
            listeners.add(onChange)
            window.addEventListener('storage', onChange)
            return () => {
                listeners.delete(onChange)
                window.removeEventListener('storage', onChange)
            }
        },
        () => readFlag(key),
        () => false,
    )
    const set = (next: boolean) => {
        try {
            if (next) localStorage.setItem(key, '1')
            else localStorage.removeItem(key)
        } catch {
            // Storage blocked: the setting lasts until reload.
        }
        for (const listener of listeners) listener()
    }
    return [value, set]
}

/**
 * Screen Wake Lock for shopping with the phone in hand. The browser drops the
 * lock whenever the tab is hidden, so it is requested again on return.
 */
export function useWakeLock() {
    const supported = useSyncExternalStore(
        noop,
        () => 'wakeLock' in navigator,
        () => false,
    )
    const [active, setActive] = useState(false)
    const sentinel = useRef<WakeLockSentinel | null>(null)

    useEffect(() => {
        if (!active) return
        let cancelled = false
        const request = async () => {
            if (document.visibilityState !== 'visible' || sentinel.current) return
            try {
                const lock = await navigator.wakeLock.request('screen')
                if (cancelled) {
                    void lock.release()
                    return
                }
                sentinel.current = lock
                lock.addEventListener('release', () => {
                    if (sentinel.current === lock) sentinel.current = null
                })
            } catch {
                if (!cancelled) setActive(false)
            }
        }
        void request()
        document.addEventListener('visibilitychange', request)
        return () => {
            cancelled = true
            document.removeEventListener('visibilitychange', request)
            void sentinel.current?.release()
            sentinel.current = null
        }
    }, [active])

    return { supported, active, setActive }
}
