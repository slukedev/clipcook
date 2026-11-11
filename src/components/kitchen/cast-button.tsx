'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { IconButton } from '@/components/ui/icon-button'
import { useSnackbar } from '@/components/ui/snackbar'

/** Custom message channel shared with the receiver at /display/cast. */
export const CAST_NAMESPACE = 'urn:x-cast:app.clipcook'
const APP_ID = process.env.NEXT_PUBLIC_CAST_APP_ID
const SENDER_SDK = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1'

// The slice of the Cast Web Sender framework this file touches.
interface CastSession {
    sendMessage(namespace: string, message: unknown): Promise<unknown>
}
interface CastContext {
    setOptions(options: { receiverApplicationId: string; autoJoinPolicy: string }): void
    getCastState(): string
    requestSession(): Promise<unknown>
    getCurrentSession(): CastSession | null
    addEventListener(type: string, handler: (event: { castState: string }) => void): void
    removeEventListener(type: string, handler: (event: { castState: string }) => void): void
}
interface CastFramework {
    CastContext: { getInstance(): CastContext }
    CastContextEventType: { CAST_STATE_CHANGED: string }
    CastState: { NO_DEVICES_AVAILABLE: string }
}
interface CastWindow {
    cast?: { framework?: CastFramework }
    chrome?: { cast?: { AutoJoinPolicy: { ORIGIN_SCOPED: string } } }
    __onGCastApiAvailable?: (available: boolean) => void
}

let sdk: Promise<CastFramework | null> | null = null

/** Chrome only; the SDK does nothing anywhere else, so other browsers never load it. */
function loadSender(): Promise<CastFramework | null> {
    if (sdk) return sdk
    sdk = new Promise((resolve) => {
        const w = window as unknown as CastWindow
        if (!APP_ID || !/Chrome\//.test(navigator.userAgent) || /Edg\/|OPR\//.test(navigator.userAgent)) {
            resolve(null)
            return
        }
        w.__onGCastApiAvailable = (available) => {
            const framework = w.cast?.framework
            const policy = w.chrome?.cast?.AutoJoinPolicy.ORIGIN_SCOPED
            if (!available || !framework || !policy) {
                resolve(null)
                return
            }
            framework.CastContext.getInstance().setOptions({ receiverApplicationId: APP_ID, autoJoinPolicy: policy })
            resolve(framework)
        }
        const script = document.createElement('script')
        script.src = SENDER_SDK
        script.async = true
        script.onerror = () => resolve(null)
        document.head.appendChild(script)
    })
    return sdk
}

export interface CastButtonProps {
    /** Opens this recipe on the Cast device once it is linked. */
    recipeId?: string
    /** `<Icon name="cast" />`, rendered by the server caller. */
    icon: ReactNode
    className?: string
}

/**
 * Casts ClipCook to a Nest Hub or Chromecast. The receiver gets a one-time token
 * and links itself as a kitchen display, so nobody signs in on the TV. Renders
 * nothing unless Cast is configured, the browser is Chrome, and a device is around.
 */
export function CastButton({ recipeId, icon, className }: CastButtonProps) {
    const snackbar = useSnackbar()
    const [framework, setFramework] = useState<CastFramework | null>(null)
    const [devices, setDevices] = useState(false)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!APP_ID) return
        let cancelled = false
        let detach: (() => void) | undefined
        const load = () =>
            loadSender().then((fw) => {
                if (cancelled || !fw) return
                setFramework(fw)
                const context = fw.CastContext.getInstance()
                const sync = () => setDevices(context.getCastState() !== fw.CastState.NO_DEVICES_AVAILABLE)
                sync()
                const handler = () => sync()
                context.addEventListener(fw.CastContextEventType.CAST_STATE_CHANGED, handler)
                detach = () => context.removeEventListener(fw.CastContextEventType.CAST_STATE_CHANGED, handler)
            })
        // The SDK is not needed for first paint.
        const idle = 'requestIdleCallback' in window ? requestIdleCallback(load) : setTimeout(load, 1500)
        return () => {
            cancelled = true
            detach?.()
            if ('cancelIdleCallback' in window && typeof idle === 'number') cancelIdleCallback(idle)
        }
    }, [])

    if (!APP_ID || !framework || !devices) return null

    async function cast() {
        if (!framework || busy) return
        setBusy(true)
        try {
            const context = framework.CastContext.getInstance()
            try {
                await context.requestSession()
            } catch (err) {
                // The picker was closed: not an error worth a message.
                if (err === 'cancel' || (err as { code?: string })?.code === 'cancel') return
                throw err
            }
            const session = context.getCurrentSession()
            if (!session) throw new Error('No cast session')
            const res = await fetch('/api/display/cast-token', { method: 'POST' })
            if (!res.ok) throw new Error(`cast-token ${res.status}`)
            const { token } = (await res.json()) as { token: string }
            await session.sendMessage(CAST_NAMESPACE, {
                type: 'claim',
                token,
                origin: window.location.origin,
                ...(recipeId ? { recipeId } : {}),
            })
        } catch {
            snackbar('Could not cast. Check the device and try again.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <IconButton
            label="Cast to a display"
            icon={icon}
            className={className}
            onClick={cast}
            disabled={busy}
            aria-busy={busy || undefined}
        />
    )
}
