'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { ActionResult } from '@/lib/domain/types'
import { fail } from '@/server/action-utils'
import { createDemoSession, createSession, destroySession } from '@/server/auth'
import { backend } from '@/server/db'

const idTokenSchema = z.string().min(1).max(4096)

/**
 * Only same-origin paths; '//evil.example' and '/\\evil' are rejected. The length cap
 * is generous because a share-target link carries the whole shared text (/clip?text=).
 */
function safeNext(next: unknown): string {
    if (typeof next !== 'string' || next.length > 8192) return '/'
    if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
    if (next.startsWith('/login')) return '/'
    return next
}

/** Exchanges a Firebase ID token for a session cookie, then redirects to `next` (default '/'). */
export async function signInWithIdToken(idToken: string, next?: string): Promise<ActionResult> {
    const token = idTokenSchema.safeParse(idToken)
    if (!token.success) return fail('Sign-in failed. Try again.')
    if (backend() !== 'firebase') return fail('Google sign-in is not set up here. Use the demo account.')
    try {
        await createSession(token.data)
    } catch {
        return fail('Sign-in failed. Try again.')
    }
    redirect(safeNext(next))
}

/** Signs in as the demo cook (local backend only), then redirects to `next`. */
export async function signInDemo(next?: string): Promise<ActionResult> {
    if (backend() !== 'local') return fail('The demo account is only available in local mode.')
    await createDemoSession()
    redirect(safeNext(next))
}

export async function signOut(): Promise<void> {
    await destroySession()
    redirect('/login')
}
