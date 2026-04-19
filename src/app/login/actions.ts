'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createSession, destroySession } from '@/server/auth'

const idTokenSchema = z.string().min(1).max(4096)
const nextPathSchema = z
    .string()
    .max(512)
    .regex(/^\/(?!\/)/, 'invalid redirect')
    .optional()

export async function signInAction(idToken: string, nextPath?: string): Promise<void> {
    const token = idTokenSchema.parse(idToken)
    const dest = nextPathSchema.safeParse(nextPath)
    await createSession(token)
    redirect(dest.success && dest.data ? dest.data : '/')
}

export async function signOutAction(): Promise<void> {
    await destroySession()
    redirect('/login')
}
