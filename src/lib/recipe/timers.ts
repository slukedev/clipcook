// Finds durations in instruction text so cook mode can offer timers. Client-safe.

import { normalizeFractions, VULGAR_FRACTION_CHARS } from './text'
import { parseNumberToken } from './time'

export interface StepTimer {
    /** Character offsets into the original text. */
    start: number
    end: number
    /** The matched words, e.g. '10 to 12 minutes'. */
    label: string
    /** Lower bound in seconds; a range starts the timer at its minimum. */
    seconds: number
    /** Upper bound for ranges, else equal to seconds. */
    maxSeconds: number
}

const NUMBER = String.raw`(?:\d*\s?[${VULGAR_FRACTION_CHARS}]|\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty-five|forty|sixty|ninety|half(?:\s+an?)?)`
const UNIT = String.raw`(?:hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)`
const RANGE_SEP = String.raw`\s*(?:-|–|\u2014|to|or)\s*`
const PART = String.raw`${NUMBER}(?:${RANGE_SEP}${NUMBER})?[\s-]*${UNIT}\b(?:\s+and\s+a\s+half)?`
const TIMER = new RegExp(
    String.raw`(?<![\w/.])(?:${PART})(?:(?:\s*,\s*|\s+and\s+|\s+)(?:${PART}))*`,
    'gi',
)
const PART_RE = new RegExp(
    String.raw`(?<min>${NUMBER})(?:${RANGE_SEP}(?<max>${NUMBER}))?[\s-]*(?<unit>${UNIT})\b(?<half>\s+and\s+a\s+half)?`,
    'gi',
)

function unitSeconds(unit: string): number {
    const u = unit.toLowerCase()
    if (u.startsWith('h')) return 3600
    if (u.startsWith('m')) return 60
    return 1
}

function amount(token: string): number | null {
    const t = token.trim().toLowerCase()
    if (/^half(\s+an?)?$/.test(t)) return 0.5
    return parseNumberToken(t)
}

/** '10 to 12 minutes', '1 hour 30 min', '45 sec', 'an hour and a half', '1½ hours'. */
export function findTimers(text: string): StepTimer[] {
    const timers: StepTimer[] = []
    for (const match of text.matchAll(TIMER)) {
        const label = match[0]
        const normalized = normalizeFractions(label)
        let min = 0
        let max = 0
        let valid = true
        let sawUnit = false
        for (const part of normalized.matchAll(PART_RE)) {
            const g = part.groups ?? {}
            const lo = amount(g.min ?? '')
            const hi = g.max ? amount(g.max) : lo
            const unit = g.unit ?? ''
            // Bare 'h', 'm', 's' only count glued to a digit ('5m', '30s'), never after words.
            if (unit.length === 1 && !/\d[hms]$/i.test(part[0].trim())) valid = false
            if (lo === null || hi === null) {
                valid = false
                continue
            }
            const per = unitSeconds(unit)
            const extra = g.half ? 0.5 : 0
            min += (lo + extra) * per
            max += (hi + extra) * per
            sawUnit = true
        }
        if (!valid || !sawUnit || min <= 0) continue
        const start = match.index ?? 0
        timers.push({
            start,
            end: start + label.length,
            label,
            seconds: Math.round(min),
            maxSeconds: Math.round(max),
        })
    }
    return timers
}

/** 90 → '1:30', 3725 → '1:02:05'. */
export function formatClock(totalSeconds: number): string {
    const s = Math.max(0, Math.round(totalSeconds))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    const pad = (n: number) => String(n).padStart(2, '0')
    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}
