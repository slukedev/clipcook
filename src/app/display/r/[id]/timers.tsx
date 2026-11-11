'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { formatClock } from '@/lib/recipe/timers'
import styles from './timers.module.scss'

export interface DisplayTimer {
    id: string
    label: string
    /** Where it came from: 'Step 3, Shakshuka'. */
    detail: string
    total: number
    /** Wall-clock end while running; null while paused. */
    endsAt: number | null
    /** Seconds left when paused. */
    left: number
}

export interface TimerIcons {
    timer: ReactNode
    pause: ReactNode
    play: ReactNode
    close: ReactNode
}

const MAX_TIMERS = 6
const RING_FOR_MS = 120_000
const RING_EVERY_MS = 4000

/** A soft two-note bell from the Web Audio API: quiet attack, long decay, no file to fetch. */
function chime(ctx: AudioContext) {
    const now = ctx.currentTime
    for (const [offset, freq] of [
        [0, 784],
        [0.28, 1047],
    ] as const) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, now + offset)
        gain.gain.exponentialRampToValueAtTime(0.16, now + offset + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 1.4)
        osc.connect(gain).connect(ctx.destination)
        osc.start(now + offset)
        osc.stop(now + offset + 1.45)
    }
}

export function secondsLeft(timer: DisplayTimer, now: number): number {
    return timer.endsAt === null ? timer.left : Math.max(0, Math.ceil((timer.endsAt - now) / 1000))
}

export function isRinging(timer: DisplayTimer, now: number): boolean {
    return timer.endsAt !== null && timer.endsAt <= now
}

/**
 * The display's kitchen timers. They live above the routes, so a timer keeps running
 * (and rings) when someone goes back to the home screen or opens another recipe.
 */
export function useDisplayTimers() {
    const [timers, setTimers] = useState<DisplayTimer[]>([])
    const [now, setNow] = useState(() => Date.now())
    const audio = useRef<AudioContext | null>(null)
    const running = timers.some((t) => t.endsAt !== null)

    // Re-render on each whole second of the clock so the digits tick in step.
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

    const ringing = timers.some((t) => isRinging(t, now))

    // Chime until someone dismisses it, for at most two minutes.
    useEffect(() => {
        if (!ringing || !audio.current) return
        const ctx = audio.current
        chime(ctx)
        const id = setInterval(() => chime(ctx), RING_EVERY_MS)
        const stop = setTimeout(() => clearInterval(id), RING_FOR_MS)
        return () => {
            clearInterval(id)
            clearTimeout(stop)
        }
    }, [ringing])

    function start(id: string, label: string, detail: string, seconds: number) {
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
            const timer: DisplayTimer = { id, label, detail, total: seconds, endsAt: t + seconds * 1000, left: seconds }
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

    function addMinute(id: string) {
        const t = Date.now()
        setNow(t)
        setTimers((list) =>
            list.map((x) => {
                if (x.id !== id) return x
                if (x.endsAt === null) return { ...x, left: x.left + 60, total: x.total + 60 }
                const from = Math.max(x.endsAt, t)
                return { ...x, endsAt: from + 60_000, total: x.total + 60 }
            }),
        )
    }

    function dismiss(id: string) {
        setTimers((list) => list.filter((x) => x.id !== id))
    }

    function dismissRinging() {
        const t = Date.now()
        setTimers((list) => list.filter((x) => !isRinging(x, t)))
    }

    return { timers, now, ringing, start, toggle, addMinute, dismiss, dismissRinging }
}

export type DisplayTimers = ReturnType<typeof useDisplayTimers>

/** The step view's row of timers: tap to pause or resume, tap a finished one to dismiss. */
export function TimerTray({ timers: model, icons }: { timers: DisplayTimers; icons: TimerIcons }) {
    const { timers, now, toggle, dismiss } = model
    if (timers.length === 0) return null
    return (
        <ul className={styles.timers} aria-label="Timers">
            {timers.map((timer) => {
                const left = secondsLeft(timer, now)
                const done = isRinging(timer, now)
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

/**
 * Wherever the display is (home, overview, another recipe), running timers stay one
 * 64dp tap away: a pill by the corner menu opens every timer, big. When one ends the
 * screen pulses, a soft chime repeats, and the sheet opens itself with Dismiss under
 * the thumb.
 */
export function TimersOverlay({ timers: model, icons }: { timers: DisplayTimers; icons: TimerIcons }) {
    const { timers, now, ringing, toggle, addMinute, dismiss, dismissRinging } = model
    const [open, setOpen] = useState(false)
    const [wasRinging, setWasRinging] = useState(false)
    // Ringing opens the sheet once; closing it keeps it closed until the next ring.
    if (ringing !== wasRinging) {
        setWasRinging(ringing)
        if (ringing) setOpen(true)
    }
    if (open && timers.length === 0) setOpen(false)

    if (timers.length === 0) return null
    const soonest = timers.reduce<DisplayTimer | null>((best, t) => {
        if (!best) return t
        return secondsLeft(t, now) < secondsLeft(best, now) ? t : best
    }, null)
    const ringingCount = timers.filter((t) => isRinging(t, now)).length

    return (
        <>
            <div className={styles.pulse} data-ringing={ringing || undefined} aria-hidden />
            <button
                type="button"
                className={styles.timersPill}
                data-ringing={ringing || undefined}
                onClick={() => setOpen(true)}
                aria-label={
                    ringing
                        ? `${ringingCount === 1 ? 'A timer is' : `${ringingCount} timers are`} done. Show timers`
                        : `Timers, ${timers.length} running. Show timers`
                }
            >
                <span className={styles.timerIcon} aria-hidden>
                    {icons.timer}
                </span>
                <span className={styles.timerClock} aria-hidden>
                    {ringing ? 'Done' : soonest ? formatClock(secondsLeft(soonest, now)) : ''}
                </span>
                {timers.length > 1 && (
                    <span className={styles.pillCount} aria-hidden>
                        {timers.length}
                    </span>
                )}
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    headline="Timers"
                    className={styles.timersSheet}
                    actions={
                        ringing ? (
                            <Button size="l" className={styles.sheetAction} onClick={dismissRinging}>
                                Dismiss
                            </Button>
                        ) : (
                            <DialogClose render={<Button size="l" variant="tonal" className={styles.sheetAction} />}>
                                Close
                            </DialogClose>
                        )
                    }
                >
                    <ul className={styles.sheetList}>
                        {timers.map((timer) => {
                            const left = secondsLeft(timer, now)
                            const done = isRinging(timer, now)
                            const paused = timer.endsAt === null
                            return (
                                <li
                                    key={timer.id}
                                    className={styles.sheetTimer}
                                    data-done={done || undefined}
                                    data-paused={paused || undefined}
                                >
                                    <span className={styles.sheetText}>
                                        <span className={styles.sheetClock} role="timer">
                                            {done ? 'Done' : formatClock(left)}
                                        </span>
                                        <span className={styles.sheetDetail}>
                                            {timer.label}, {timer.detail}
                                        </span>
                                    </span>
                                    {!done && (
                                        <button
                                            type="button"
                                            className={styles.sheetButton}
                                            onClick={() => addMinute(timer.id)}
                                            aria-label={`Add 1 minute to ${timer.label} timer`}
                                        >
                                            +1 min
                                        </button>
                                    )}
                                    {!done && (
                                        <button
                                            type="button"
                                            className={styles.sheetButton}
                                            onClick={() => toggle(timer.id)}
                                            aria-label={`${paused ? 'Resume' : 'Pause'} ${timer.label} timer`}
                                        >
                                            {paused ? icons.play : icons.pause}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className={styles.sheetButton}
                                        onClick={() => dismiss(timer.id)}
                                        aria-label={`${done ? 'Dismiss' : 'Remove'} ${timer.label} timer`}
                                    >
                                        {icons.close}
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                </DialogContent>
            </Dialog>
        </>
    )
}
