'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { LinearProgress } from '@/components/ui/progress'
import { MorphShape } from '@/components/ui/shape'
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
    | { kind: 'error'; message: string }

const POLL_MS = 2500
/** Ask for a fresh code this long before the current one expires. */
const REFRESH_EARLY_MS = 20_000

/** The QR arrives as black-on-white markup; recolor it so it follows the theme. */
function themeQr(svg: string): string {
    return svg.replace(/stroke="#000000"/g, 'stroke="currentColor"').replace(/<path fill="#ffffff"[^>]*\/>/, '')
}

async function startPairing(): Promise<Pairing | { error: string; retryAfter: number }> {
    try {
        const res = await fetch('/api/display/pair', { method: 'POST', cache: 'no-store' })
        if (res.status === 429) {
            const retryAfter = Number(res.headers.get('Retry-After')) || 60
            return { error: 'Too many codes for now. A new one is on the way.', retryAfter }
        }
        if (!res.ok) return { error: 'Could not get a code. Retrying.', retryAfter: 10 }
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
        return { error: 'No connection. Retrying.', retryAfter: 10 }
    }
}

export function Pairing({ icons }: { icons: { done: ReactNode; error: ReactNode } }) {
    const router = useRouter()
    const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
    const [remaining, setRemaining] = useState(1)
    const generation = useRef(0)

    // Get a code, then poll for the claim; any dead end loops back to a new code.
    useEffect(() => {
        let cancelled = false
        let timer: ReturnType<typeof setTimeout> | undefined
        let current: Pairing | null = null
        const run = ++generation.current

        const fresh = async () => {
            clearTimeout(timer)
            const result = await startPairing()
            if (cancelled || run !== generation.current) return
            if ('error' in result) {
                setPhase({ kind: 'error', message: result.error })
                timer = setTimeout(fresh, result.retryAfter * 1000)
                return
            }
            current = result
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

        void fresh()
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            cancelled = true
            clearTimeout(timer)
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [router])

    // Countdown for the progress bar, a few updates a second is plenty.
    useEffect(() => {
        if (phase.kind !== 'ready') return
        const { receivedAt, ttl } = phase.pairing
        const tick = () => setRemaining(Math.max(0, 1 - (Date.now() - receivedAt) / ttl))
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [phase])

    const pairing = phase.kind === 'ready' ? phase.pairing : null
    const claimed = phase.kind === 'claimed'

    return (
        <main className={styles.root} data-phase={phase.kind}>
            <section className={styles.text} aria-live="polite">
                <h1 className={styles.title}>{claimed ? 'Linked' : 'Link this display'}</h1>
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
                                <span className={styles.codePlaceholder} />
                            )}
                        </p>
                        <p className={styles.instruction} data-hidden={pairing ? undefined : ''}>
                            On your phone, open <strong>{pairing ? `${pairing.host}/link` : '/link'}</strong>
                        </p>
                        <div className={styles.progress}>
                            {pairing && <LinearProgress value={remaining} wavy label="Code expires" />}
                        </div>
                        {phase.kind === 'error' && (
                            <p className={styles.error} role="status">
                                <span aria-hidden>{icons.error}</span>
                                {phase.message}
                            </p>
                        )}
                    </>
                )}
            </section>

            <div className={styles.visual} aria-hidden={claimed ? true : undefined}>
                <MorphShape shape={claimed ? 'sunny' : 'cookie12'} spring="spatial-slow" className={styles.blob} />
                <div className={styles.qr} data-hidden={pairing ? undefined : ''}>
                    {pairing && (
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: server-rendered QR markup from our own API
                        <div className={styles.qrCode} dangerouslySetInnerHTML={{ __html: pairing.qrSvg }} />
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
