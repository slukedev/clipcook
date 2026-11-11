'use client'

import { useSyncExternalStore } from 'react'

// Chromium fires `beforeinstallprompt` once, early, on whatever page is open. The
// shell captures it so Settings can offer "Install app" later.

interface InstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
let attached = false

function emit() {
    for (const listener of listeners) listener()
}

export function captureInstallPrompt() {
    if (attached || typeof window === 'undefined') return
    attached = true
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault()
        deferred = event as InstallPromptEvent
        emit()
    })
    window.addEventListener('appinstalled', () => {
        deferred = null
        installed = true
        emit()
    })
}

export type InstallState = 'installed' | 'available' | 'ios' | 'unavailable'

function standalone(): boolean {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    )
}

function iosSafari(): boolean {
    const ua = navigator.userAgent
    const ios = /iP(hone|ad|od)/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
    return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

function snapshot(): InstallState {
    if (installed || standalone()) return 'installed'
    if (deferred) return 'available'
    if (iosSafari()) return 'ios'
    return 'unavailable'
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function useInstallState(): InstallState {
    return useSyncExternalStore(subscribe, snapshot, () => 'unavailable')
}

/** Shows the browser's install dialog. Resolves true when the user accepts. */
export async function promptInstall(): Promise<boolean> {
    const event = deferred
    if (!event) return false
    await event.prompt()
    const { outcome } = await event.userChoice
    deferred = null
    if (outcome === 'accepted') installed = true
    emit()
    return outcome === 'accepted'
}
