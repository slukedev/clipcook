'use client'

import { createContext, type ReactNode, use } from 'react'
import type { SessionUser } from '@/server/auth'

const SessionContext = createContext<SessionUser | null>(null)

export function SessionProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
    return <SessionContext value={user}>{children}</SessionContext>
}

/** The signed-in user. Every route under (app) has one. */
export function useSessionUser(): SessionUser {
    const user = use(SessionContext)
    if (!user) throw new Error('useSessionUser must be used inside <SessionProvider>')
    return user
}
