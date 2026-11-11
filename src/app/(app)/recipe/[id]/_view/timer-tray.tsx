'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { cx } from '@/components/ui/cx'
import { Glyph } from '@/components/ui/icon/glyph'
import { IconButton } from '@/components/ui/icon-button'
import { type KitchenTimer, remainingMs, timerActions, useClock, useTimers } from '@/lib/cook/timers'
import { formatClock } from '@/lib/recipe/timers'
import styles from './timer-tray.module.scss'

/**
 * Every timer that is running, paused or ringing, wherever it was started. Sticks under
 * the top bar on the recipe page; cook mode shows a larger version with +1 min.
 */
export function TimerTray({
    recipeId,
    icons,
    variant = 'page',
    className,
}: {
    recipeId: string
    icons: { timer: ReactNode; play: ReactNode; pause: ReactNode }
    variant?: 'page' | 'cook'
    className?: string
}) {
    const timers = useTimers()
    const now = useClock()
    if (timers.length === 0) return null
    const cook = variant === 'cook'

    return (
        <section className={cx(styles.tray, cook && styles.cook, className)} aria-label="Timers">
            <ul className={styles.list}>
                {timers.map((t) => {
                    const left = remainingMs(t, now || Date.now())
                    const clock = formatClock(Math.ceil(left / 1000))
                    const name = t.step ? `Step ${t.step}` : 'Timer'
                    const where = t.recipeId === recipeId ? name : `${t.recipeTitle}, ${name.toLowerCase()}`
                    return (
                        <li
                            key={t.id}
                            className={styles.item}
                            data-state={t.state}
                            data-timer={`${t.recipeId}:${t.step}:${t.label}`}
                        >
                            <TimerFill timer={t} />
                            <span className={styles.icon}>{icons.timer}</span>
                            <span className={styles.text}>
                                <span className={styles.where}>{where}</span>
                                <span className={styles.clock} role="timer" aria-live="off">
                                    {t.state === 'done' ? 'Done' : clock}
                                </span>
                            </span>
                            {t.state !== 'done' && cook && (
                                <IconButton
                                    className={styles.button}
                                    size={cook ? 'm' : 's'}
                                    label={`Add 1 minute to ${where}`}
                                    icon={<span className={styles.plus}>+1 min</span>}
                                    onClick={() => timerActions.addMinute(t.id)}
                                />
                            )}
                            {t.state !== 'done' && (
                                <IconButton
                                    className={styles.button}
                                    size={cook ? 'm' : 's'}
                                    label={t.state === 'running' ? `Pause ${where}` : `Resume ${where}`}
                                    icon={t.state === 'running' ? icons.pause : icons.play}
                                    onClick={() =>
                                        t.state === 'running' ? timerActions.pause(t.id) : timerActions.resume(t.id)
                                    }
                                />
                            )}
                            <IconButton
                                className={styles.button}
                                size={cook ? 'm' : 's'}
                                label={t.state === 'done' ? `Dismiss ${where}` : `Cancel ${where}`}
                                icon={t.state === 'done' ? <Glyph name="check" /> : <Glyph name="close" />}
                                onClick={() => timerActions.cancel(t.id)}
                            />
                        </li>
                    )
                })}
            </ul>
            <p className={styles.announcer} aria-live="assertive">
                {timers
                    .filter((t) => t.state === 'done')
                    .map((t) => (t.step ? `Step ${t.step} timer done.` : 'Timer done.'))
                    .join(' ')}
            </p>
        </section>
    )
}

/**
 * The elapsed share as one continuous animation over the timer's whole length, run by
 * the compositor at the screen's refresh rate. The once-a-second clock never touches
 * it, so it cannot hitch when a tick lands a frame early or late.
 */
function TimerFill({ timer }: { timer: KitchenTimer }) {
    const ref = useRef<HTMLSpanElement>(null)
    const { state, totalMs, endsAt, remainingMs: pausedLeft } = timer
    useEffect(() => {
        const el = ref.current
        if (!el || state === 'done' || totalMs <= 0) return
        const left = state === 'running' ? Math.max(0, endsAt - Date.now()) : pausedLeft
        const animation = el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
            duration: totalMs,
            easing: 'linear',
            fill: 'both',
        })
        animation.currentTime = Math.min(totalMs, Math.max(0, totalMs - left))
        if (state === 'paused') animation.pause()
        return () => animation.cancel()
    }, [state, totalMs, endsAt, pausedLeft])
    return <span ref={ref} className={styles.progress} aria-hidden />
}
