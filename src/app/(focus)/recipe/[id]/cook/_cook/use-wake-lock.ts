'use client'

import { useEffect } from 'react'

/** Keeps the screen on while cook mode is open. The lock drops when the tab hides, so it is taken again. */
export function useWakeLock() {
    useEffect(() => {
        let lock: WakeLockSentinel | null = null
        let disposed = false
        const acquire = async () => {
            if (disposed || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return
            if (lock && !lock.released) return
            try {
                const next = await navigator.wakeLock.request('screen')
                if (disposed) void next.release()
                else lock = next
            } catch {
                // Battery saver or an unsupported browser: the screen may dim, nothing else breaks.
            }
        }
        void acquire()
        document.addEventListener('visibilitychange', acquire)
        return () => {
            disposed = true
            document.removeEventListener('visibilitychange', acquire)
            void lock?.release().catch(() => undefined)
        }
    }, [])
}
