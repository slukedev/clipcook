import 'server-only'

import type { Store } from './types'

export type Backend = 'firebase' | 'local'

const ADMIN_VARS = ['FIREBASE_ADMIN_PROJECT_ID', 'FIREBASE_ADMIN_CLIENT_EMAIL', 'FIREBASE_ADMIN_PRIVATE_KEY'] as const

/**
 * CLIPCOOK_BACKEND wins. Otherwise Firebase when its admin credentials exist, the
 * local file store in development and tests, and a hard error in production so a
 * misconfigured deploy never silently writes user data to an ephemeral disk.
 */
export function resolveBackend(env: Record<string, string | undefined> = process.env): Backend {
    const explicit = env.CLIPCOOK_BACKEND?.trim().toLowerCase()
    if (explicit === 'firebase' || explicit === 'local') return explicit
    if (explicit) throw new Error(`CLIPCOOK_BACKEND must be "firebase" or "local", got "${explicit}".`)
    if (ADMIN_VARS.every((key) => env[key])) return 'firebase'
    if (env.NODE_ENV !== 'production') return 'local'
    throw new Error(
        'No backend configured. Set the FIREBASE_ADMIN_* variables, or CLIPCOOK_BACKEND=local to use the file store.',
    )
}

let store: Promise<Store> | null = null

/** Process-wide store; it holds connections, never request data. */
export function getStore(): Promise<Store> {
    store ??= (async () => {
        if (resolveBackend() === 'local') {
            const { LocalStore } = await import('./local')
            return new LocalStore()
        }
        const { FirestoreStore } = await import('./firestore')
        return new FirestoreStore()
    })().catch((err: unknown) => {
        store = null
        throw err
    })
    return store
}

export function backend(): Backend {
    return resolveBackend()
}

export type { Store } from './types'
export { StoreError } from './types'
