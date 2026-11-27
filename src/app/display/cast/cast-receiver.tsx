'use client'

import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { type ReactNode, useEffect, useState } from 'react'
import { LoadingIndicator } from '@/components/ui/loading-indicator'
import { Shape } from '@/components/ui/shape'
import { CAST_NAMESPACE, type CastReply } from '@/lib/cast'
import styles from './cast.module.scss'

const RECEIVER_SDK = 'https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js'
const DEVICE_KEY = 'clipcook.cast.device'
/** Past this, the SDK is not coming (blocked or offline). */
const SDK_TIMEOUT_MS = 15_000
/** Past this with no claim, nobody is casting: say what to do instead of spinning forever. */
const CLAIM_TIMEOUT_MS = 20_000
/** The claim and the first render of the display, including a cold server start. */
const LINK_TIMEOUT_MS = 25_000

// The slice of the CAF receiver API used here.
interface ReceiverContext {
    addCustomMessageListener(namespace: string, listener: (event: { data: unknown; senderId: string }) => void): void
    sendCustomMessage(namespace: string, senderId: string | undefined, message: unknown): void
    start(options: object): void
}
interface ReceiverFramework {
    CastReceiverContext: { getInstance(): ReceiverContext }
    CastReceiverOptions: new () => Record<string, unknown>
    ui?: { UiConfig?: new () => Record<string, unknown> }
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
        (m.origin === undefined || typeof m.origin === 'string') &&
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

type Status =
    | { kind: 'loading' }
    | { kind: 'waiting' }
    | { kind: 'idle' }
    | { kind: 'linking' }
    | { kind: 'error'; reason: 'expired' | 'failed' | 'origin' }

// The receiver context is a page singleton and must outlive this component: after the
// claim the app navigates (client side) to /display, and later casts still land there.
// The handlers point at whichever CastReceiver is mounted, and are no-ops otherwise.
let started = false
let navigate: ((href: string) => void) | null = null
let report: ((status: Status) => void) | null = null

function startReceiver() {
    const framework = (window as unknown as ReceiverWindow).cast?.framework
    if (started || !framework) return
    started = true
    const context = framework.CastReceiverContext.getInstance()
    const reply = (senderId: string, message: CastReply) => context.sendCustomMessage(CAST_NAMESPACE, senderId, message)

    context.addCustomMessageListener(CAST_NAMESPACE, async (event) => {
        if (!isClaim(event.data)) return
        const { token, origin, recipeId } = event.data
        // The token only works on the deployment that minted it, so a phone on another
        // address (www, a preview URL, a LAN IP) learns where to cast from instead of hanging.
        if (origin && origin !== window.location.origin) {
            report?.({ kind: 'error', reason: 'origin' })
            reply(event.senderId, { type: 'error', reason: 'origin', origin: window.location.origin })
            return
        }
        report?.({ kind: 'linking' })
        try {
            const res = await fetch('/api/display/cast-claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, deviceId: deviceId() }),
            })
            if (!res.ok) {
                const reason = res.status === 401 ? 'expired' : 'failed'
                report?.({ kind: 'error', reason })
                reply(event.senderId, { type: 'error', reason })
                return
            }
            reply(event.senderId, { type: 'claimed' })
            const href = recipeId && /^[A-Za-z0-9_-]{1,64}$/.test(recipeId) ? `/display/r/${recipeId}` : '/display'
            navigate?.(href)
        } catch {
            report?.({ kind: 'error', reason: 'failed' })
            reply(event.senderId, { type: 'error', reason: 'failed' })
        }
    })

    const options = new framework.CastReceiverOptions()
    options.disableIdleTimeout = true
    // Tells smart displays the page is interactive (the documented half of touch support).
    const uiConfig = framework.ui?.UiConfig ? new framework.ui.UiConfig() : {}
    uiConfig.touchScreenOptimizedApp = true
    options.uiConfig = uiConfig
    options.skipPlayersLoad = true
    options.customNamespaces = { [CAST_NAMESPACE]: framework.system.MessageType.JSON }
    context.start(options)
    hideTouchControls()
    report?.({ kind: 'waiting' })
}

/**
 * On a Nest Hub the SDK lays its own <touch-controls> media overlay over the page, and it
 * swallows every tap whatever uiConfig says (Home Assistant's receiver hides it the same
 * way). A style outside React, so it holds after the client-side move to /display.
 */
function hideTouchControls() {
    const style = document.createElement('style')
    style.textContent = 'touch-controls { display: none !important; }'
    document.head.append(style)
}

function statusText(status: Status): ReactNode {
    switch (status.kind) {
        case 'idle':
            return 'Cast from ClipCook on your phone'
        case 'error':
            if (status.reason === 'origin')
                return (
                    <>
                        Open <strong className={styles.host}>{window.location.host}</strong> on your phone and cast
                        again
                    </>
                )
            if (status.reason === 'expired') return 'That cast link expired. Cast again.'
            return 'Could not connect. Cast again.'
        default:
            return 'Connecting'
    }
}

export function CastReceiver() {
    const router = useRouter()
    const [status, setStatus] = useState<Status>({ kind: 'loading' })

    useEffect(() => {
        navigate = (href) => {
            router.replace(href)
            router.refresh()
        }
        report = setStatus
        // Back on this page with the receiver already running, or the script loaded earlier.
        if (started) setStatus({ kind: 'waiting' })
        else if ((window as unknown as ReceiverWindow).cast?.framework) startReceiver()
        return () => {
            report = null
        }
    }, [router])

    // Never spin forever: a missing SDK, a claim that never comes and a link that never
    // lands each end in a next step.
    useEffect(() => {
        const next: Record<string, [number, Status]> = {
            loading: [SDK_TIMEOUT_MS, { kind: 'error', reason: 'failed' }],
            waiting: [CLAIM_TIMEOUT_MS, { kind: 'idle' }],
            linking: [LINK_TIMEOUT_MS, { kind: 'error', reason: 'failed' }],
        }
        const step = next[status.kind]
        if (!step) return
        const timer = setTimeout(() => setStatus(step[1]), step[0])
        return () => clearTimeout(timer)
    }, [status.kind])

    const busy = status.kind === 'loading' || status.kind === 'waiting' || status.kind === 'linking'

    return (
        <main className={styles.root}>
            <Script
                src={RECEIVER_SDK}
                strategy="afterInteractive"
                onReady={startReceiver}
                onError={() => setStatus({ kind: 'error', reason: 'failed' })}
            />
            {busy ? (
                <LoadingIndicator size={96} label="Connecting" />
            ) : (
                <Shape name="cookie9" size={96} className={styles.settled} />
            )}
            <p className={styles.status} role="status">
                {statusText(status)}
            </p>
        </main>
    )
}
