'use client'

// How a finished timer gets attention: a short chime (WebAudio, no asset), a vibration
// and, when the page is hidden and the user allowed it, a system notification.

let audio: AudioContext | null = null

/** Creates or resumes the audio context. Call from a user gesture so later chimes may play. */
export function primeAudio(): void {
    try {
        const Ctor =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctor) return
        audio ??= new Ctor()
        if (audio.state === 'suspended') void audio.resume()
    } catch {
        audio = null
    }
}

/** Three rising sine notes, played twice. About two seconds. */
export function chime(): void {
    if (!audio) primeAudio()
    const ctx = audio
    if (!ctx) return
    try {
        const notes = [880, 1175, 1568]
        const start = ctx.currentTime + 0.02
        for (let round = 0; round < 2; round++) {
            notes.forEach((freq, k) => {
                const t = start + round * 1 + k * 0.16
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.type = 'sine'
                osc.frequency.value = freq
                gain.gain.setValueAtTime(0, t)
                gain.gain.linearRampToValueAtTime(0.22, t + 0.02)
                gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
                osc.connect(gain).connect(ctx.destination)
                osc.start(t)
                osc.stop(t + 0.65)
            })
        }
    } catch {
        // No sound is better than a broken timer.
    }
}

export function buzz(): void {
    try {
        navigator.vibrate?.([300, 120, 300, 120, 300])
    } catch {
        // Unsupported.
    }
}

/** Asks once, at the moment a timer starts, so the reason is obvious. */
export function requestNotificationPermission(): void {
    try {
        if (typeof Notification === 'undefined' || Notification.permission !== 'default') return
        void Notification.requestPermission().catch(() => undefined)
    } catch {
        // Unsupported.
    }
}

export async function notify(title: string, body: string, tag: string): Promise<void> {
    try {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
        if (document.visibilityState === 'visible' && document.hasFocus()) return
        const registration = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
        const options: NotificationOptions = { body, tag, icon: '/apple-touch-icon.png' }
        if (registration) await registration.showNotification(title, { ...options, requireInteraction: true })
        else new Notification(title, options)
    } catch {
        // Android Chrome refuses `new Notification`; the chime and vibration still ran.
    }
}
