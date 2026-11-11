// Calendar dates for the meal plan. A plan date is a local calendar day written as
// YYYY-MM-DD with no time zone; all arithmetic runs on UTC midnights, so daylight
// saving changes never shift a day. Pure and client-safe.

export type WeekStart = 'monday' | 'sunday'

export const WEEK_START_COOKIE = 'cc-week-start'
export const TIME_ZONE_COOKIE = 'cc-tz'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 86_400_000

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** True only for a real calendar date in YYYY-MM-DD form ('2026-02-30' is false). */
export function isISODate(value: unknown): value is string {
    if (typeof value !== 'string') return false
    const m = ISO_DATE.exec(value)
    if (!m) return false
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (y < 1970 || y > 9999 || mo < 1 || mo > 12 || d < 1) return false
    return toISODate(Date.UTC(y, mo - 1, d)) === value
}

function utc(date: string): number {
    const m = ISO_DATE.exec(date)
    if (!m) throw new RangeError(`Not a date: ${date}`)
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function toISODate(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
    return toISODate(utc(date) + days * DAY_MS)
}

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export function daysBetween(a: string, b: string): number {
    return Math.round((utc(b) - utc(a)) / DAY_MS)
}

/** 0 is Sunday, as in Date#getDay. */
export function dayOfWeek(date: string): number {
    return new Date(utc(date)).getUTCDay()
}

/** The first day of the week that holds `date`. */
export function weekStartOf(date: string, weekStart: WeekStart): string {
    const first = weekStart === 'sunday' ? 0 : 1
    return addDays(date, -((dayOfWeek(date) - first + 7) % 7))
}

/** The seven dates of the week that starts on `start`. */
export function weekDates(start: string): string[] {
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
    if (!timeZone || timeZone.length > 64) return false
    try {
        new Intl.DateTimeFormat('en-US', { timeZone })
        return true
    } catch {
        return false
    }
}

/** The calendar date at `now` in `timeZone`; UTC when the zone is missing or unknown. */
export function todayIn(timeZone: string | null | undefined, now: number = Date.now()): string {
    const zone = isValidTimeZone(timeZone) ? timeZone : 'UTC'
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date(now))
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    return `${get('year')}-${get('month')}-${get('day')}`
}

/** The browser's own calendar date. */
export function localToday(now: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Hour of the day (0 to 23) at `now` in `timeZone`. */
export function hourIn(timeZone: string | null | undefined, now: number = Date.now()): number {
    const zone = isValidTimeZone(timeZone) ? timeZone : 'UTC'
    const hour = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', hourCycle: 'h23' }).format(
        new Date(now),
    )
    return Number(hour) % 24
}

// Regions whose calendars start the week on Sunday (CLDR week data).
const SUNDAY_REGIONS = new Set(
    'AG AS BD BR BS BT BW BZ CA CO DM DO ET GT GU HK HN ID IL IN JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW'.split(
        ' ',
    ),
)

/** Sunday for regions that start the week on Sunday (US, Canada, Japan...), Monday otherwise. */
export function defaultWeekStart(acceptLanguage: string | null | undefined): WeekStart {
    const first = (acceptLanguage ?? '').split(',')[0]?.split(';')[0]?.trim() ?? ''
    const region = first
        .split(/[-_]/)
        .slice(1)
        .find((part) => /^[A-Za-z]{2}$/.test(part))
    return region && SUNDAY_REGIONS.has(region.toUpperCase()) ? 'sunday' : 'monday'
}

export function parseWeekStart(value: string | null | undefined): WeekStart | null {
    return value === 'monday' || value === 'sunday' ? value : null
}

/** `?week=` normalized to the start of its week; anything invalid means this week. */
export function weekFromParam(param: unknown, today: string, weekStart: WeekStart): string {
    const date = isISODate(param) ? param : today
    return weekStartOf(date, weekStart)
}

function parts(date: string) {
    const m = ISO_DATE.exec(date)
    return { year: Number(m?.[1]), month: Number(m?.[2]) - 1, day: Number(m?.[3]) }
}

/** 'Nov 9' */
export function shortDate(date: string): string {
    const p = parts(date)
    return `${MONTHS[p.month]} ${p.day}`
}

/** 'Nov 9 to 15', 'Nov 30 to Dec 6', 'Dec 28, 2026 to Jan 3, 2027'; the year shows when it is not `thisYear`. */
export function formatWeekRange(start: string, today: string): string {
    const end = addDays(start, 6)
    const a = parts(start)
    const b = parts(end)
    const thisYear = parts(today).year
    if (a.year !== b.year) return `${shortDate(start)}, ${a.year} to ${shortDate(end)}, ${b.year}`
    const year = a.year === thisYear ? '' : `, ${a.year}`
    if (a.month === b.month) return `${MONTHS[a.month]} ${a.day} to ${b.day}${year}`
    return `${shortDate(start)} to ${shortDate(end)}${year}`
}

/** 'Monday' */
export function weekdayName(date: string): string {
    return WEEKDAYS[dayOfWeek(date)] ?? ''
}

/** 'Mon' */
export function weekdayShort(date: string): string {
    return weekdayName(date).slice(0, 3)
}

export function dayOfMonth(date: string): number {
    return parts(date).day
}

/** 'Today', 'Tomorrow', 'Yesterday', or the weekday. */
export function relativeDayName(date: string, today: string): string {
    const diff = daysBetween(today, date)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    if (diff === -1) return 'Yesterday'
    return weekdayName(date)
}

/** 'Wednesday, November 11' for screen readers and headings that need the whole date. */
export function longDate(date: string): string {
    const p = parts(date)
    const month = new Date(Date.UTC(2000, p.month, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
    return `${weekdayName(date)}, ${month} ${p.day}`
}
