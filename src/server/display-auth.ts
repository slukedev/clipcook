import 'server-only'

import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'
import { cache } from 'react'
import { getStore } from './db'
import type { DisplayRecord } from './db/types'
import { authenticateDisplay } from './displays'

export const DISPLAY_COOKIE = 'clipcook_display'
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

export function displayCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        maxAge: ONE_YEAR_SECONDS,
    }
}

export function setDisplayCookie(res: NextResponse, value: string): void {
    res.cookies.set(DISPLAY_COOKIE, value, displayCookieOptions())
}

export function clearDisplayCookie(res: NextResponse): void {
    res.cookies.set(DISPLAY_COOKIE, '', { ...displayCookieOptions(), maxAge: 0 })
}

/** The display this browser is paired as, for server components under /display. Deduped per request. */
export const getDisplaySession = cache(async (): Promise<DisplayRecord | null> => {
    const jar = await cookies()
    const value = jar.get(DISPLAY_COOKIE)?.value
    if (!value) return null
    return authenticateDisplay(await getStore(), value)
})

/** Same, for route handlers that already hold the request. */
export async function displayFromRequest(req: NextRequest): Promise<DisplayRecord | null> {
    const value = req.cookies.get(DISPLAY_COOKIE)?.value
    if (!value) return null
    return authenticateDisplay(await getStore(), value)
}
