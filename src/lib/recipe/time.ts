// Durations: ISO 8601 and human text to minutes, and back to short labels. Client-safe.

import { normalizeFractions } from './text'

const ISO = /^P(?:(\d+(?:[.,]\d+)?)Y)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/i

const NUMBER_WORDS: Record<string, number> = {
    a: 1,
    an: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    fifteen: 15,
    twenty: 20,
    thirty: 30,
    forty: 40,
    'forty-five': 45,
    sixty: 60,
    ninety: 90,
}

export function parseNumberToken(token: string): number | null {
    const t = normalizeFractions(token.trim().toLowerCase())
    if (t in NUMBER_WORDS) return NUMBER_WORDS[t] ?? null
    if (t === 'half' || t === 'a half') return 0.5
    const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t)
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
    const frac = /^(\d+)\/(\d+)$/.exec(t)
    if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2])
    const n = Number(t.replace(',', '.'))
    return Number.isFinite(n) ? n : null
}

function parseIso(value: string): number | null {
    const m = ISO.exec(value.trim())
    if (!m || value.trim().toUpperCase() === 'P' || value.trim().toUpperCase() === 'PT') return null
    const n = (i: number) => Number((m[i] ?? '0').replace(',', '.'))
    const minutes =
        n(1) * 525_600 + n(2) * 43_800 + n(3) * 10_080 + n(4) * 1_440 + n(5) * 60 + n(6) + n(7) / 60
    return Number.isFinite(minutes) ? minutes : null
}

const UNIT_MINUTES: Array<[RegExp, number]> = [
    [/^(d|days?)$/, 1440],
    [/^(h|hrs?|hours?)$/, 60],
    [/^(m|mins?|minutes?)$/, 1],
    [/^(s|secs?|seconds?)$/, 1 / 60],
]

const HUMAN_PART =
    /(?<![\w/])(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty-five|forty|sixty|ninety|half)\s*(?:(?:-|to|–)\s*(?:\d+(?:[.,]\d+)?)\s*)?(days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b(\s+and\s+a\s+half)?/gi

/**
 * Parses '1 hr 15 min', 'PT1H15M', '1 1/2 hours', '1:30', '45' (bare minutes), 'an hour and a half'.
 * Ranges count their lower bound. Returns whole minutes, or null when nothing parses.
 */
export function parseDurationToMinutes(input: string | null | undefined): number | null {
    if (!input) return null
    const text = normalizeFractions(String(input).trim())
    if (!text) return null
    if (/^P/i.test(text)) {
        const iso = parseIso(text)
        return iso === null ? null : Math.round(iso)
    }
    const clock = /^(\d{1,2}):(\d{2})$/.exec(text)
    if (clock) return Number(clock[1]) * 60 + Number(clock[2])
    if (/^\d+(?:\.\d+)?$/.test(text)) return Math.round(Number(text))

    let total = 0
    let matched = false
    for (const m of text.toLowerCase().matchAll(HUMAN_PART)) {
        const qty = parseNumberToken(m[1] ?? '')
        const unit = (m[2] ?? '').toLowerCase()
        const per = UNIT_MINUTES.find(([re]) => re.test(unit))?.[1]
        if (qty === null || per === undefined) continue
        total += (qty + (m[3] ? 0.5 : 0)) * per
        matched = true
    }
    if (!matched && /\bhalf an hour\b/i.test(text)) return 30
    return matched ? Math.round(total) : null
}

/** 75 → '1 hr 15 min', 45 → '45 min', 1500 → '1 day 1 hr'. */
export function formatMinutes(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes <= 0) return ''
    const rounded = Math.round(minutes)
    if (rounded === 0) return `${Math.max(1, Math.round(minutes * 60))} sec`
    const days = Math.floor(rounded / 1440)
    const hours = Math.floor((rounded % 1440) / 60)
    const mins = rounded % 60
    const parts: string[] = []
    if (days) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`)
    if (hours) parts.push(`${hours} hr`)
    if (mins && days === 0) parts.push(`${mins} min`)
    return parts.join(' ')
}

/** Normalizes any duration text to the stored label ('1 hr 15 min'); keeps unparseable text as is. */
export function normalizeDurationLabel(value: string | null | undefined): string {
    if (!value) return ''
    const minutes = parseDurationToMinutes(value)
    return minutes === null ? value.trim() : formatMinutes(minutes)
}

/** totalTime when present, otherwise prep plus cook. */
export function deriveTotalMinutes(times: { totalTime?: string; prepTime?: string; cookTime?: string }): number | null {
    const total = parseDurationToMinutes(times.totalTime)
    if (total !== null && total > 0) return total
    const prep = parseDurationToMinutes(times.prepTime)
    const cook = parseDurationToMinutes(times.cookTime)
    if (prep === null && cook === null) return null
    const sum = (prep ?? 0) + (cook ?? 0)
    return sum > 0 ? sum : null
}
