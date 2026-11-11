'use client'

import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { useEffect, useState } from 'react'
import { LoadingIndicator } from '@/components/ui/loading-indicator'
import styles from './cast.module.scss'

const RECEIVER_SDK = 'https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js'
const NAMESPACE = 'urn:x-cast:app.clipcook'
const DEVICE_KEY = 'clipcook.cast.device'

// The slice of the CAF receiver API used here.
interface ReceiverContext {
    addCustomMessageListener(namespace: string, listener: (event: { data: unknown; senderId: string }) => void): void
    sendCustomMessage(namespace: string, senderId: string | undefined, message: unknown): void
    start(options: object): void
}
interface ReceiverFramework {
    CastReceiverContext: { getInstance(): ReceiverContext }
    CastReceiverOptions: new () => Record<string, unknown>
    system: { MessageType: { JSON: string } }
}
interface ReceiverWindow {
    cast?: { framework?: ReceiverFramework }
}

interface ClaimMessage {
    type: 'claim'
    token: string
    origin?: string
    recipeId?: string
}

function isClaim(data: unknown): data is ClaimMessage {
    if (typeof data !== 'object' || data === null) return false
    const m = data as Record<string, unknown>
    return (
        m.type === 'claim' &&
        typeof m.token === 'string' &&
        (m.recipeId === undefined || typeof m.recipeId === 'string')
    )
}

/** A stable id per Cast device, so casting again reuses its display entry instead of adding one. */
function deviceId(): string | null {
    try {
        let id = localStorage.getItem(DEVICE_KEY)
        if (!id) {
            id = crypto.randomUUID().replaceAll('-', '')
            localStorage.setItem(DEVICE_KEY, id)
        }
        return id
    } catch {
        return null
    }
}

// The receiver context is a page singleton and must outlive this component: after the
// claim the app navigates (client side) to /display, and later casts still land here.
let started = false
let navigate: ((href: string) => void) | null = null

function startReceiver(setStatus: (status: Status) => void) {
    const framework = (window as unknown as ReceiverWindow).cast?.framework
    if (started || !framework) return
    started = true
    const context = framework.CastReceiverContext.getInstance()
    context.addCustomMessageListener(NAMESPACE, async (event) => {
        if (!isClaim(event.data)) return
        // Only claims minted by this same deployment are accepted.
        if (event.data.origin && event.data.origin !== window.location.origin) return
        const { token, recipeId } = event.data
        setStatus('linking')
        try {
            const res = await fetch('/api/display/cast-claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, deviceId: deviceId() }),
            })
            if (!res.ok) throw new Error(String(res.status))
            context.sendCustomMessage(NAMESPACE, event.senderId, { type: 'claimed' })
            const href = recipeId && /^[A-Za-z0-9_-]{1,64}$/.test(recipeId) ? `/display/r/${recipeId}` : '/display'
            navigate?.(href)
        } catch {
            setStatus('error')
            context.sendCustomMessage(NAMESPACE, event.senderId, { type: 'error' })
        }
    })
    const options = new framework.CastReceiverOptions()
    options.disableIdleTimeout = true
    // Nest Hub: the app handles taps and swipes itself, so keep targets off the edges.
    options.touchScreenOptimizedApp = true
    options.skipPlayersLoad = true
    options.customNamespaces = { [NAMESPACE]: framework.system.MessageType.JSON }
    context.start(options)
    setStatus('waiting')
}

type Status = 'loading' | 'waiting' | 'linking' | 'error'

export function CastReceiver() {
    const router = useRouter()
    const [status, setStatus] = useState<Status>('loading')

    useEffect(() => {
        navigate = (href) => {
            router.replace(href)
            router.refresh()
        }
        // Script already loaded on an earlier visit to this page.
        if ((window as unknown as ReceiverWindow).cast?.framework) startReceiver(setStatus)
    }, [router])

    return (
        <main className={styles.root}>
            <Script src={RECEIVER_SDK} strategy="afterInteractive" onReady={() => startReceiver(setStatus)} />
            <LoadingIndicator size={96} label={status === 'error' ? 'Cast failed' : 'Connecting'} />
            <p className={styles.status} role="status">
                {status === 'error' ? 'Could not link. Try casting again.' : 'Connecting'}
            </p>
        </main>
    )
}
