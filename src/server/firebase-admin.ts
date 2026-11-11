import 'server-only'

import type { Bucket } from '@google-cloud/storage'
import { type App, cert, getApps, initializeApp } from 'firebase-admin/app'
import { type Auth, getAuth } from 'firebase-admin/auth'
import { type Firestore, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

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

export function adminBucket(): Bucket {
    // The public env var doubles as the server-side bucket name so the
    // .env surface stays unchanged.
    return getStorage(getAdminApp()).bucket(requireEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'))
}
