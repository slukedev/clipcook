import 'server-only'

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

function requireEnv(key: string): string {
    const value = process.env[key]
    if (!value) throw new Error(`Missing required env var: ${key}`)
    return value
}

let cachedApp: App | null = null

function getAdminApp(): App {
    if (cachedApp) return cachedApp
    const existing = getApps()[0]
    if (existing) {
        cachedApp = existing
        return existing
    }
    cachedApp = initializeApp({
        credential: cert({
            projectId: requireEnv('FIREBASE_ADMIN_PROJECT_ID'),
            clientEmail: requireEnv('FIREBASE_ADMIN_CLIENT_EMAIL'),
            privateKey: requireEnv('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n'),
        }),
    })
    return cachedApp
}

export function adminAuth(): Auth {
    return getAuth(getAdminApp())
}

export function adminDb(): Firestore {
    return getFirestore(getAdminApp())
}
