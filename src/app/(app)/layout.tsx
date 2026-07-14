import { redirect } from 'next/navigation'
import { SnackbarProvider } from '@/components/ui'
import { getSession, type SessionUser } from '@/server/auth'
import { AppBar } from './app-bar'
import { SessionProvider } from './session-context'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    let session: SessionUser | null
    try {
        session = await getSession()
    } catch {
        // Establishing the session failed outright (e.g. a legacy cookie whose
        // verification tries to load firebase-admin and blows up). Treat it as
        // signed-out rather than surfacing a 500.
        session = null
    }
    // The proxy guarantees a session cookie is present before an authed route
    // renders, so a missing/invalid session here means the cookie is stale.
    // Clear it via the admin-free sign-out handler instead of redirecting to
    // /login — the proxy would bounce a cookie-bearing request back here and loop.
    if (!session) redirect('/api/auth/signout')

    return (
        <SessionProvider user={session}>
            <SnackbarProvider>
                <AppBar />
                {children}
            </SnackbarProvider>
        </SessionProvider>
    )
}
