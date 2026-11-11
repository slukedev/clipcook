import 'server-only'

import { cookies, headers } from 'next/headers'
import {
    defaultWeekStart,
    hourIn,
    isValidTimeZone,
    parseWeekStart,
    TIME_ZONE_COOKIE,
    todayIn,
    WEEK_START_COOKIE,
    type WeekStart,
} from '@/lib/plan/week'

export interface PlanClock {
    /** The cook's own calendar date. */
    today: string
    /** 0 to 23 in the cook's time zone. */
    hour: number
    weekStart: WeekStart
}

function cookieValue(raw: string | undefined): string | undefined {
    if (!raw) return undefined
    try {
        return decodeURIComponent(raw)
    } catch {
        return undefined
    }
}

/**
 * "Today" as the cook sees it. The app shell stores the browser's time zone in a cookie;
 * until it has, the server falls back to UTC. Weeks start on the day the cook chose in
 * Settings, else the custom of their region.
 */
export async function getPlanClock(now: number = Date.now()): Promise<PlanClock> {
    const [jar, head] = await Promise.all([cookies(), headers()])
    const tz = cookieValue(jar.get(TIME_ZONE_COOKIE)?.value)
    const zone = isValidTimeZone(tz) ? tz : 'UTC'
    const weekStart =
        parseWeekStart(cookieValue(jar.get(WEEK_START_COOKIE)?.value)) ?? defaultWeekStart(head.get('accept-language'))
    return { today: todayIn(zone, now), hour: hourIn(zone, now), weekStart }
}
