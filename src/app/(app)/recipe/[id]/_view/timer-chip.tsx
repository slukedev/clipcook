'use client'

import type { ReactNode } from 'react'
import { cx } from '@/components/ui/cx'
import { Ripple } from '@/components/ui/ripple'
import { type KitchenTimer, remainingMs, timerActions, useClock, useTimers } from '@/lib/cook/timers'
import { findTimers, formatClock, type StepTimer } from '@/lib/recipe/timers'
import styles from './timer-chip.module.scss'

export interface TimerContext {
    recipeId: string
    recipeTitle: string
    /** 1-based step number. */
    step: number
}

function findRunning(timers: readonly KitchenTimer[], ctx: TimerContext, label: string) {
    return timers.find((t) => t.recipeId === ctx.recipeId && t.step === ctx.step && t.label === label)
}

/**
 * A duration found in a step, as a button: tap to start, tap again to pause or resume,
 * and once it rings, tap to dismiss. Shows the time left while it runs.
 */
export function TimerChip({
    timer,
    ctx,
    icon,
    size = 'inline',
}: {
    timer: StepTimer
    ctx: TimerContext
    icon: ReactNode
    size?: 'inline' | 'large'
}) {
    const timers = useTimers()
    const now = useClock()
    const active = findRunning(timers, ctx, timer.label)
    const left = active ? remainingMs(active, now || Date.now()) : 0
    const state = active?.state ?? 'idle'

    const onClick = () => {
        if (!active) {
            timerActions.start({ ...ctx, label: timer.label, seconds: timer.seconds })
        } else if (active.state === 'running') timerActions.pause(active.id)
        else if (active.state === 'paused') timerActions.resume(active.id)
        else timerActions.cancel(active.id)
    }

    const clock = formatClock(Math.ceil(left / 1000))
    const name =
        state === 'idle'
            ? `Start ${timer.label} timer`
            : state === 'running'
              ? `Pause timer, ${clock} left`
              : state === 'paused'
                ? `Resume timer, ${clock} left`
                : 'Timer done. Dismiss'

    return (
        <button
            type="button"
            className={cx(styles.chip, size === 'large' && styles.large)}
            data-state={state}
            aria-label={name}
            onClick={onClick}
        >
            <Ripple />
            <span className={styles.icon}>{icon}</span>
            <span className={styles.label}>{state === 'idle' ? timer.label : state === 'done' ? 'Done' : clock}</span>
        </button>
    )
}

/** Punctuation that belongs to the words before it and must not wrap away from a chip. */
const TRAILING = /^[.,;:!?)\]]+/

/** Step text with every duration turned into a TimerChip. */
export function StepText({ text, ctx, icon }: { text: string; ctx: TimerContext; icon: ReactNode }) {
    const found = findTimers(text)
    if (found.length === 0) return <>{text}</>
    const parts: ReactNode[] = []
    let cursor = 0
    for (const timer of found) {
        if (timer.start > cursor) parts.push(text.slice(cursor, timer.start))
        const chip = <TimerChip key={timer.start} timer={timer} ctx={ctx} icon={icon} />
        const tail = TRAILING.exec(text.slice(timer.end))?.[0] ?? ''
        parts.push(
            tail ? (
                <span key={timer.start} className={styles.run}>
                    {chip}
                    {tail}
                </span>
            ) : (
                chip
            ),
        )
        cursor = timer.end + tail.length
    }
    if (cursor < text.length) parts.push(text.slice(cursor))
    return <>{parts}</>
}
