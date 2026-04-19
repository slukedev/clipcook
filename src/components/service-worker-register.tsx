'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!('serviceWorker' in navigator)) return
        if (process.env.NODE_ENV !== 'production') return
        const controller = new AbortController()
        window.addEventListener(
            'load',
            () => {
                navigator.serviceWorker
                    .register('/sw.js', { scope: '/' })
                    .catch((err) => {
                        console.error('Service worker registration failed', err)
                    })
            },
            { once: true, signal: controller.signal },
        )
        return () => controller.abort()
    }, [])
    return null
}
