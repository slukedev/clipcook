import 'server-only'

import { cookies } from 'next/headers'
import { cache } from 'react'
import { adminAuth } from './firebase-admin'

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'clipcook_session'
const MAX_AGE_SECONDS = Number(process.env.SESSION_COOKIE_MAX_AGE || 60 * 60 * 24 * 14)

export interface SessionUser {
    uid: string
    email: string | null
    name: string | null
    picture: string | null
}

export const getSession = cache(async (): Promise<SessionUser | null> => {
    const jar = await cookies()
    const session = jar.get(COOKIE_NAME)?.value
    if (!session) return null
    try {
        const decoded = await adminAuth().verifySessionCookie(session, true)
        return {
            uid: decoded.uid,
            email: decoded.email ?? null,
            name: (decoded.name as string | undefined) ?? null,
            picture: (decoded.picture as string | undefined) ?? null,
        }
    } catch {
        return null
    }
})

export async function requireSession(): Promise<SessionUser> {
    const session = await getSession()
    if (!session) throw new Error('UNAUTHENTICATED')
    return session
}

export async function createSession(idToken: string): Promise<void> {
    const expiresIn = MAX_AGE_SECONDS * 1000
    const sessionCookie = await adminAuth().createSessionCookie(idToken, { expiresIn })
    const jar = await cookies()
    jar.set(COOKIE_NAME, sessionCookie, {
        maxAge: MAX_AGE_SECONDS,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    })
}

export async function destroySession(): Promise<void> {
    const jar = await cookies()
    const existing = jar.get(COOKIE_NAME)?.value
    jar.delete(COOKIE_NAME)
    if (existing) {
        try {
            const decoded = await adminAuth().verifySessionCookie(existing)
            await adminAuth().revokeRefreshTokens(decoded.sub)
        } catch {
            // nothing to revoke
        }
    }
}
