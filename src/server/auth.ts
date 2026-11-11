import 'server-only'

import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { hmac, safeEqual } from './crypto'
import { backend } from './db'
import { localDataDir } from './db/local'

export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || 'clipcook_session'
const MAX_AGE_SECONDS = Number(process.env.SESSION_COOKIE_MAX_AGE || 60 * 60 * 24 * 14)

export interface SessionUser {
    uid: string
    email: string | null
    name: string | null
    picture: string | null
}

export const DEMO_USER: SessionUser = { uid: 'local-demo-cook', email: null, name: 'Demo cook', picture: null }

function cookieOptions(maxAge: number) {
    return {
        maxAge,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
    }
}

// ---------- local backend: HMAC-signed cookie ----------

let localSecret: Promise<string> | null = null

/** LOCAL_AUTH_SECRET, else a random secret persisted next to the local data so sessions survive restarts. */
export function getLocalSecret(): Promise<string> {
    localSecret ??= (async () => {
        const fromEnv = process.env.LOCAL_AUTH_SECRET
        if (fromEnv && fromEnv.length >= 16) return fromEnv
        const file = path.join(localDataDir(), 'secret')
        try {
            const existing = (await readFile(file, 'utf8')).trim()
            if (existing.length >= 32) return existing
        } catch {
            // first run
        }
        const secret = randomBytes(32).toString('base64url')
        await mkdir(path.dirname(file), { recursive: true })
        await writeFile(file, secret, { mode: 0o600 })
        return secret
    })().catch((err: unknown) => {
        localSecret = null
        throw err
    })
    return localSecret
}

interface LocalClaims {
    uid: string
    name: string | null
    exp: number
}

export function signLocalSession(secret: string, claims: LocalClaims): string {
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
    return `v1.${body}.${hmac(secret, `v1.${body}`)}`
}

export function verifyLocalSession(secret: string, value: string, now = Date.now()): LocalClaims | null {
    const [version, body, sig] = value.split('.')
    if (version !== 'v1' || !body || !sig) return null
    if (!safeEqual(sig, hmac(secret, `v1.${body}`))) return null
    try {
        const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as LocalClaims
        if (typeof claims.uid !== 'string' || typeof claims.exp !== 'number' || claims.exp <= now) return null
        return claims
    } catch {
        return null
    }
}

// ---------- session API ----------

async function adminAuth() {
    const mod = await import('./firebase-admin')
    return mod.adminAuth()
}

/** The signed-in user for this request, verified against the active backend. Deduped per request. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
    const jar = await cookies()
    const value = jar.get(SESSION_COOKIE)?.value
    if (!value) return null
    try {
        if (backend() === 'local') {
            const claims = verifyLocalSession(await getLocalSecret(), value)
            return claims ? { uid: claims.uid, email: null, name: claims.name, picture: null } : null
        }
        const decoded = await (await adminAuth()).verifySessionCookie(value, true)
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

export class AuthError extends Error {
    constructor() {
        super('UNAUTHENTICATED')
        this.name = 'AuthError'
    }
}

export async function requireSession(): Promise<SessionUser> {
    const session = await getSession()
    if (!session) throw new AuthError()
    return session
}

/** Exchanges a Firebase ID token for a session cookie (Firebase backend). */
export async function createSession(idToken: string): Promise<void> {
    const sessionCookie = await (await adminAuth()).createSessionCookie(idToken, { expiresIn: MAX_AGE_SECONDS * 1000 })
    const jar = await cookies()
    jar.set(SESSION_COOKIE, sessionCookie, cookieOptions(MAX_AGE_SECONDS))
}

/** Signs in the demo cook (local backend only). */
export async function createDemoSession(): Promise<SessionUser> {
    if (backend() !== 'local') throw new Error('Demo sign-in is only available with the local backend.')
    const value = signLocalSession(await getLocalSecret(), {
        uid: DEMO_USER.uid,
        name: DEMO_USER.name,
        exp: Date.now() + MAX_AGE_SECONDS * 1000,
    })
    const jar = await cookies()
    jar.set(SESSION_COOKIE, value, cookieOptions(MAX_AGE_SECONDS))
    return DEMO_USER
}

export async function destroySession(): Promise<void> {
    const jar = await cookies()
    const existing = jar.get(SESSION_COOKIE)?.value
    jar.delete(SESSION_COOKIE)
    if (!existing || backend() === 'local') return
    try {
        const auth = await adminAuth()
        const decoded = await auth.verifySessionCookie(existing)
        await auth.revokeRefreshTokens(decoded.sub)
    } catch {
        // nothing to revoke
    }
}
