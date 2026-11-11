import 'server-only'

import { revalidatePath } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { ZodError } from 'zod'
import type { ActionResult } from '@/lib/domain/types'
import { AuthError, requireSession, type SessionUser } from './auth'
import { ClipError, clipErrorMessage } from './clip/errors'
import { getStore } from './db'
import { StoreError, type Store } from './db/types'

export function ok<T>(data: T): ActionResult<T> {
    return { ok: true, data }
}

export function fail(error: string): ActionResult<never> {
    return { ok: false, error }
}

/** Maps any thrown error to one short sentence: what happened and what to do. */
export function errorMessage(err: unknown, notFound = 'That item no longer exists. Refresh and try again.'): string {
    if (err instanceof AuthError) return 'Your session ended. Sign in again.'
    if (err instanceof StoreError) {
        if (err.code === 'NOT_FOUND') return notFound
        if (err.code === 'LIMIT') return err.message
        return 'That changed somewhere else. Refresh and try again.'
    }
    if (err instanceof ClipError) return clipErrorMessage(err)
    if (err instanceof ZodError) return err.issues[0]?.message ?? 'Check your input and try again.'
    if (err instanceof Error && err.message.includes('unsupported image format')) {
        return 'That photo could not be read. Try a JPEG or PNG.'
    }
    if (process.env.NODE_ENV !== 'test') console.error(err)
    return 'Something went wrong. Try again.'
}

/**
 * Every action authenticates itself (actions are public endpoints) and never
 * throws to the client: failures come back as { ok: false, error }.
 */
export async function withUser<T>(
    fn: (ctx: { user: SessionUser; store: Store }) => Promise<ActionResult<T>>,
    notFound?: string,
): Promise<ActionResult<T>> {
    try {
        const [user, store] = await Promise.all([requireSession(), getStore()])
        return await fn({ user, store })
    } catch (err) {
        unstable_rethrow(err)
        return fail(errorMessage(err, notFound))
    }
}

/** Every signed-in page renders per user, so one layout-level invalidation keeps them all fresh. */
export function invalidateApp(): void {
    revalidatePath('/', 'layout')
}
