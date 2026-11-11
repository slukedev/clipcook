'use client'

import { useEffect } from 'react'

function register() {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
        console.error('Service worker registration failed', err)
    })
}

export function ServiceWorkerRegister() {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
        // Hydration can finish after the load event; then there is nothing left to wait for.
        if (document.readyState === 'complete') {
            register()
            return
        }
        const controller = new AbortController()
        window.addEventListener('load', register, { once: true, signal: controller.signal })
        return () => controller.abort()
    }, [])
    return null
}
