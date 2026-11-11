'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { formatClock } from '@/lib/recipe/timers'
import styles from './display-recipe.module.scss'

interface Timer {
    id: string
    label: string
    total: number
    /** Wall-clock end while running; null while paused. */
    endsAt: number | null
    /** Seconds left when paused. */
    left: number
}

const MAX_TIMERS = 4

/** A short two-tone chime from the Web Audio API; no audio file to fetch. */
function chime(ctx: AudioContext) {
    const now = ctx.currentTime
    for (const [offset, freq] of [
        [0, 880],
        [0.22, 1175],
        [0.6, 880],
        [0.82, 1175],
    ] as const) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, now + offset)
        gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2)
        osc.connect(gain).connect(ctx.destination)
        osc.start(now + offset)
        osc.stop(now + offset + 0.22)
    }
}

export function useTimers() {
    const [timers, setTimers] = useState<Timer[]>([])
    const [now, setNow] = useState(() => Date.now())
    const audio = useRef<AudioContext | null>(null)
    const running = timers.some((t) => t.endsAt !== null)

    // Re-render on each whole second of the soonest timer so the digits tick in step.
    useEffect(() => {
        if (!running) return
        let timer: ReturnType<typeof setTimeout>
        const tick = () => {
            const t = Date.now()
            setNow(t)
            timer = setTimeout(tick, 1000 - (t % 1000) + 5)
        }
        tick()
        return () => clearTimeout(timer)
    }, [running])

    const ringing = timers.some((t) => t.endsAt !== null && t.endsAt <= now)

    // Ring until someone dismisses it, for at most two minutes.
    useEffect(() => {
        if (!ringing || !audio.current) return
        const ctx = audio.current
        chime(ctx)
        const id = setInterval(() => chime(ctx), 2500)
        const stop = setTimeout(() => clearInterval(id), 120_000)
        return () => {
            clearInterval(id)
            clearTimeout(stop)
        }
    }, [ringing])

    function start(id: string, label: string, seconds: number) {
        // The tap that starts a timer is the gesture browsers need to allow sound later.
        if (!audio.current && typeof AudioContext !== 'undefined') audio.current = new AudioContext()
        void audio.current?.resume()
        const t = Date.now()
        setNow(t)
        setTimers((list) => {
            const existing = list.find((x) => x.id === id)
            if (existing) {
                return list.map((x) => (x.id === id ? { ...x, endsAt: t + x.total * 1000, left: x.total } : x))
            }
            const timer: Timer = { id, label, total: seconds, endsAt: t + seconds * 1000, left: seconds }
            return [...list, timer].slice(-MAX_TIMERS)
        })
    }

    function toggle(id: string) {
        const t = Date.now()
        setTimers((list) =>
            list.map((x) => {
                if (x.id !== id) return x
                if (x.endsAt === null) return { ...x, endsAt: t + x.left * 1000 }
                return { ...x, endsAt: null, left: Math.max(0, Math.ceil((x.endsAt - t) / 1000)) }
            }),
        )
    }

    function dismiss(id: string) {
        setTimers((list) => list.filter((x) => x.id !== id))
    }

    return { timers, now, start, toggle, dismiss }
}

export function TimerTray({
    timers: { timers, now, toggle, dismiss },
    icons,
}: {
    timers: ReturnType<typeof useTimers>
    icons: { timer: ReactNode; pause: ReactNode; play: ReactNode; close: ReactNode }
}) {
    if (timers.length === 0) return null
    return (
        <ul className={styles.timers} aria-label="Timers">
            {timers.map((timer) => {
                const left = timer.endsAt === null ? timer.left : Math.max(0, Math.ceil((timer.endsAt - now) / 1000))
                const done = timer.endsAt !== null && left === 0
                const paused = timer.endsAt === null
                return (
                    <li
                        key={timer.id}
                        className={styles.timer}
                        data-done={done || undefined}
                        data-paused={paused || undefined}
                    >
                        <button
                            type="button"
                            className={styles.timerMain}
                            onClick={() => (done ? dismiss(timer.id) : toggle(timer.id))}
                            aria-label={
                                done
                                    ? `${timer.label} timer done. Dismiss`
                                    : `${timer.label} timer, ${formatClock(left)} left. ${paused ? 'Resume' : 'Pause'}`
                            }
                        >
                            <span className={styles.timerIcon} aria-hidden>
                                {done ? icons.timer : paused ? icons.play : icons.pause}
                            </span>
                            <span className={styles.timerClock}>{done ? 'Done' : formatClock(left)}</span>
                        </button>
                        <button
                            type="button"
                            className={styles.timerClose}
                            onClick={() => dismiss(timer.id)}
                            aria-label={`Remove ${timer.label} timer`}
                        >
                            {icons.close}
                        </button>
                    </li>
                )
            })}
        </ul>
    )
}
