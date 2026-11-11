'use client'

import { useSyncExternalStore } from 'react'
import { buzz, chime, notify, primeAudio, requestNotificationPermission } from './alerts'
import { readJson, writeJson } from './storage'

// Kitchen timers shared by the recipe page and cook mode. They live in module state, so
// they keep running across client navigations and step changes, and in sessionStorage so
// a refresh keeps them. Deadlines are wall-clock (Date.now) because performance.now()
// can stall while a phone sleeps; the display only ticks while the page is visible.

export type TimerState = 'running' | 'paused' | 'done'

export interface KitchenTimer {
    id: string
    recipeId: string
    recipeTitle: string
    /** Step number shown to people (1-based), or null for a free timer. */
    step: number | null
    /** The words it came from, such as '8 to 10 minutes'. */
    label: string
    totalMs: number
    state: TimerState
    /** Epoch ms when a running timer ends. */
    endsAt: number
    /** What was left when paused. */
    remainingMs: number
}

const KEY = 'cc:timers'
const EMPTY: readonly KitchenTimer[] = Object.freeze([])

let timers: readonly KitchenTimer[] = EMPTY
let loaded = false
const listeners = new Set<() => void>()
let alarm = 0

function load() {
    if (loaded || typeof window === 'undefined') return
    loaded = true
    const saved = readJson<KitchenTimer[]>('session', KEY, [])
    timers = Array.isArray(saved) && saved.length ? saved.filter((t) => t && typeof t.id === 'string') : EMPTY
    document.addEventListener('visibilitychange', settle)
    schedule()
}

function commit(next: readonly KitchenTimer[]) {
    timers = next.length ? next : EMPTY
    writeJson('session', KEY, timers.length ? timers : null)
    schedule()
    for (const listener of listeners) listener()
}

/** Marks every timer whose deadline passed as done and alerts once for them. */
function settle() {
    const now = Date.now()
    const finished = timers.filter((t) => t.state === 'running' && t.endsAt <= now)
    if (finished.length === 0) {
        schedule()
        return
    }
    commit(timers.map((t) => (finished.includes(t) ? { ...t, state: 'done' as const, remainingMs: 0 } : t)))
    chime()
    buzz()
    for (const t of finished) {
        void notify('Timer done', t.step ? `${t.recipeTitle}: step ${t.step}` : t.recipeTitle, t.id)
    }
}

function schedule() {
    window.clearTimeout(alarm)
    const next = timers.reduce((min, t) => (t.state === 'running' ? Math.min(min, t.endsAt) : min), Infinity)
    if (next === Infinity) return
    alarm = window.setTimeout(settle, Math.max(0, next - Date.now()) + 20)
}

export function remainingMs(timer: KitchenTimer, now: number): number {
    if (timer.state === 'running') return Math.max(0, timer.endsAt - now)
    return timer.state === 'paused' ? timer.remainingMs : 0
}

function update(id: string, change: (t: KitchenTimer) => KitchenTimer | null) {
    load()
    commit(timers.flatMap((t) => (t.id === id ? (change(t) ?? []) : [t])))
}

export const timerActions = {
    start(input: { recipeId: string; recipeTitle: string; step: number | null; label: string; seconds: number }) {
        load()
        primeAudio()
        requestNotificationPermission()
        const existing = timers.find(
            (t) =>
                t.recipeId === input.recipeId && t.step === input.step && t.label === input.label && t.state !== 'done',
        )
        if (existing) return existing.id
        const totalMs = Math.max(1, input.seconds) * 1000
        const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
        commit([
            ...timers,
            { ...input, id, totalMs, state: 'running', endsAt: Date.now() + totalMs, remainingMs: totalMs },
        ])
        return id
    },
    pause(id: string) {
        update(id, (t) =>
            t.state === 'running' ? { ...t, state: 'paused', remainingMs: Math.max(0, t.endsAt - Date.now()) } : t,
        )
    },
    resume(id: string) {
        primeAudio()
        update(id, (t) => (t.state === 'paused' ? { ...t, state: 'running', endsAt: Date.now() + t.remainingMs } : t))
    },
    addMinute(id: string) {
        update(id, (t) => {
            if (t.state === 'running') return { ...t, endsAt: t.endsAt + 60_000, totalMs: t.totalMs + 60_000 }
            if (t.state === 'paused') return { ...t, remainingMs: t.remainingMs + 60_000, totalMs: t.totalMs + 60_000 }
            return { ...t, state: 'running', endsAt: Date.now() + 60_000, remainingMs: 60_000, totalMs: 60_000 }
        })
    },
    cancel(id: string) {
        update(id, () => null)
    },
}

function subscribe(onChange: () => void) {
    load()
    listeners.add(onChange)
    return () => {
        listeners.delete(onChange)
    }
}

export function useTimers(): readonly KitchenTimer[] {
    return useSyncExternalStore(
        subscribe,
        () => timers,
        () => EMPTY,
    )
}

// A clock that ticks once per displayed second, only while something runs and the page
// is visible. Between ticks it sleeps (no work on every frame of a 120Hz screen), then
// wakes a little early and lands the change on a rAF so it paints with the next frame.
let now = 0
const clockListeners = new Set<() => void>()
let frame = 0
let sleep = 0

function running() {
    return document.visibilityState === 'visible' && timers.some((t) => t.state === 'running')
}

function tick() {
    frame = 0
    if (!running()) return
    const current = Date.now()
    if (Math.floor(current / 1000) !== Math.floor(now / 1000)) {
        now = current
        for (const listener of clockListeners) listener()
    }
    const untilNext = 1000 - (Date.now() % 1000)
    // Wake about a frame early; the rAF loop covers the last few milliseconds.
    if (untilNext > 24)
        sleep = window.setTimeout(() => {
            sleep = 0
            frame = requestAnimationFrame(tick)
        }, untilNext - 20)
    else frame = requestAnimationFrame(tick)
}

function stopClock() {
    cancelAnimationFrame(frame)
    window.clearTimeout(sleep)
    frame = 0
    sleep = 0
}

function wake() {
    if (!frame && !sleep && clockListeners.size) {
        now = Date.now()
        for (const listener of clockListeners) listener()
        frame = requestAnimationFrame(tick)
    }
}

function subscribeClock(onChange: () => void) {
    load()
    clockListeners.add(onChange)
    listeners.add(wake)
    document.addEventListener('visibilitychange', wake)
    wake()
    return () => {
        clockListeners.delete(onChange)
        if (clockListeners.size === 0) {
            listeners.delete(wake)
            document.removeEventListener('visibilitychange', wake)
            stopClock()
        }
    }
}

/** Epoch ms, refreshed every second while a timer runs. 0 on the server. */
export function useClock(): number {
    return useSyncExternalStore(
        subscribeClock,
        () => now,
        () => 0,
    )
}
