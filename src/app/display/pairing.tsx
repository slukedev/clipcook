'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { LoadingIndicator } from '@/components/ui/loading-indicator'
import { LinearProgress } from '@/components/ui/progress'
import { MorphShape } from '@/components/ui/shape'
import { readJson, writeJson } from '@/lib/cook/storage'
import styles from './pairing.module.scss'

interface Pairing {
    code: string
    pairingId: string
    pollToken: string
    expiresAt: number
    /** Local clock time the code arrived; the countdown runs on our clock, not the server's. */
    receivedAt: number
    ttl: number
    host: string
    qrSvg: string
}

type Phase =
    | { kind: 'loading' }
    | { kind: 'ready'; pairing: Pairing }
    | { kind: 'claimed' }
    | { kind: 'error'; message: string; retryAt: number; offline: boolean }

const POLL_MS = 2500
/** Ask for a fresh code this long before the current one expires. */
const REFRESH_EARLY_MS = 20_000
/** A reload keeps showing the same code: new codes are rate limited per network. */
const STORE_KEY = 'cc:display-pairing'
const DEVICE_KEY = 'cc:display-device'

/** The QR arrives as black-on-white markup; recolor it so it follows the theme. */
function themeQr(svg: string): string {
    return svg.replace(/stroke="#000000"/g, 'stroke="currentColor"').replace(/<path fill="#ffffff"[^>]*\/>/, '')
}

function storedPairing(): Pairing | null {
    const saved = readJson<Pairing | null>('session', STORE_KEY, null)
    if (!saved || typeof saved.code !== 'string' || typeof saved.pollToken !== 'string') return null
    // Local clock: the stored receivedAt and ttl were both measured here.
    return Date.now() - saved.receivedAt < saved.ttl - REFRESH_EARLY_MS ? saved : null
}

/**
 * This screen's own id, kept across lost cookies so linking it again replaces its old
 * entry instead of adding another. Null where storage is blocked; pairing still works.
 */
function deviceId(): string | null {
    const saved = readJson<string | null>('local', DEVICE_KEY, null)
    if (typeof saved === 'string' && saved) return saved
    try {
        const id = crypto.randomUUID()
        writeJson('local', DEVICE_KEY, id)
        return readJson<string | null>('local', DEVICE_KEY, null) === id ? id : null
    } catch {
        return null
    }
}

async function startPairing(): Promise<Pairing | { error: string; retryAfter: number; offline: boolean }> {
    try {
        const res = await fetch('/api/display/pair', {
            method: 'POST',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: deviceId() }),
        })
        if (res.status === 429) {
            const retryAfter = Number(res.headers.get('Retry-After')) || 60
            return { error: 'Too many new codes.', retryAfter, offline: false }
        }
        if (!res.ok) return { error: 'Could not get a code.', retryAfter: 10, offline: false }
        const data = (await res.json()) as {
            code: string
            pairingId: string
            pollToken: string
            expiresAt: number
            linkUrl: string
            qrSvg: string
        }
        const now = Date.now()
        return {
            code: data.code,
            pairingId: data.pairingId,
            pollToken: data.pollToken,
            expiresAt: data.expiresAt,
            receivedAt: now,
            ttl: Math.max(60_000, data.expiresAt - now),
            host: new URL(data.linkUrl).host,
            qrSvg: themeQr(data.qrSvg),
        }
    } catch {
        return { error: 'No connection.', retryAfter: 10, offline: true }
    }
}

function formatWait(ms: number): string {
    const seconds = Math.max(0, Math.ceil(ms / 1000))
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function Pairing({ icons }: { icons: { done: ReactNode; error: ReactNode; wait: ReactNode } }) {
    const router = useRouter()
    const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
    const [remaining, setRemaining] = useState(1)
    const [now, setNow] = useState(0)
    const generation = useRef(0)

    // Get a code, then poll for the claim; any dead end loops back to a new code.
    useEffect(() => {
        let cancelled = false
        let timer: ReturnType<typeof setTimeout> | undefined
        let current: Pairing | null = null
        const run = ++generation.current

        const fresh = async () => {
            clearTimeout(timer)
            current = null
            writeJson('session', STORE_KEY, null)
            const result = await startPairing()
            if (cancelled || run !== generation.current) return
            if ('error' in result) {
                setPhase({
                    kind: 'error',
                    message: result.error,
                    retryAt: Date.now() + result.retryAfter * 1000,
                    offline: result.offline,
                })
                timer = setTimeout(fresh, result.retryAfter * 1000)
                return
            }
            current = result
            writeJson('session', STORE_KEY, result)
            setPhase({ kind: 'ready', pairing: result })
            schedule()
        }

        const schedule = () => {
            clearTimeout(timer)
            if (document.visibilityState === 'visible') timer = setTimeout(poll, POLL_MS)
        }

        const poll = async () => {
            const pairing = current
            if (!pairing || cancelled) return
            if (Date.now() - pairing.receivedAt > pairing.ttl - REFRESH_EARLY_MS) {
                void fresh()
                return
            }
            try {
                const res = await fetch(`/api/display/pair/status?pairingId=${encodeURIComponent(pairing.pairingId)}`, {
                    headers: { 'x-poll-token': pairing.pollToken },
                    cache: 'no-store',
                })
                if (cancelled) return
                if (res.status === 410 || res.status === 404) {
                    void fresh()
                    return
                }
                if (res.ok) {
                    const body = (await res.json()) as { status: string }
                    if (body.status === 'claimed') {
                        writeJson('session', STORE_KEY, null)
                        setPhase({ kind: 'claimed' })
                        // Let the morph land before the home screen replaces this view.
                        timer = setTimeout(() => router.refresh(), 1200)
                        return
                    }
                }
            } catch {
                // Offline for a moment; keep the code on screen and try again.
            }
            schedule()
        }

        const onVisibility = () => {
            if (document.visibilityState === 'visible' && current) void poll()
            else clearTimeout(timer)
        }

        const resumed = storedPairing()
        if (resumed) {
            current = resumed
            setPhase({ kind: 'ready', pairing: resumed })
            void poll()
        } else {
            void fresh()
        }
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            cancelled = true
            clearTimeout(timer)
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [router])

    // Countdowns: the code's life for the progress bar, the wait before the next try.
    // Once a second is plenty; the bar eases between values.
    useEffect(() => {
        if (phase.kind !== 'ready' && phase.kind !== 'error') return
        const tick = () => {
            const t = Date.now()
            setNow(t)
            if (phase.kind === 'ready') {
                setRemaining(Math.max(0, 1 - (t - phase.pairing.receivedAt) / phase.pairing.ttl))
            }
        }
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [phase])

    const pairing = phase.kind === 'ready' ? phase.pairing : null
    const claimed = phase.kind === 'claimed'

    return (
        <main className={styles.root} data-phase={phase.kind}>
            <section className={styles.text} aria-live="polite">
                <h1 className={styles.title}>{claimed ? 'Linked' : 'Link This Display'}</h1>
                {!claimed && (
                    <>
                        <p className={styles.code}>
                            {pairing ? (
                                <>
                                    <span className={styles.srOnly}>Code {pairing.code.split('').join(' ')}</span>
                                    <CodeGroup chars={pairing.code.slice(0, 3)} />
                                    <CodeGroup chars={pairing.code.slice(3)} />
                                </>
                            ) : (
                                phase.kind === 'loading' && <span className={styles.codePlaceholder} />
                            )}
                        </p>
                        <p className={styles.instruction} data-hidden={pairing ? undefined : ''}>
                            On another device, open <strong>{pairing ? `${pairing.host}/link` : '/link'}</strong>
                        </p>
                        <div className={styles.progress}>
                            {pairing && <LinearProgress value={remaining} wavy label="Code expires" />}
                        </div>
                        {phase.kind === 'error' && (
                            <p className={styles.error} role="status">
                                <span aria-hidden>{phase.offline ? icons.error : icons.wait}</span>
                                <span>
                                    {phase.message} New code in{' '}
                                    <span className={styles.wait}>{formatWait(phase.retryAt - now)}</span>
                                </span>
                            </p>
                        )}
                    </>
                )}
            </section>

            <div className={styles.visual} aria-hidden={claimed ? true : undefined}>
                <MorphShape shape={claimed ? 'sunny' : 'cookie12'} spring="spatial-slow" className={styles.blob} />
                <div className={styles.qr} data-waiting={pairing || claimed ? undefined : ''}>
                    {pairing ? (
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: server-rendered QR markup from our own API
                        <div className={styles.qrCode} dangerouslySetInnerHTML={{ __html: pairing.qrSvg }} />
                    ) : (
                        !claimed && <LoadingIndicator size={96} label="Getting a code" />
                    )}
                </div>
                <span className={styles.check}>{icons.done}</span>
            </div>
        </main>
    )
}

/** Each character gets a fixed cell so the code reads as monospaced in Google Sans Flex. */
function CodeGroup({ chars }: { chars: string }) {
    return (
        <span className={styles.codeGroup} aria-hidden>
            {chars.split('').map((char, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: characters repeat; position is the identity
                <span key={i} className={styles.codeChar}>
                    {char}
                </span>
            ))}
        </span>
    )
}
