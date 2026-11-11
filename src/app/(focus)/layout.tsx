import { redirect } from 'next/navigation'
import { getSession, type SessionUser } from '@/server/auth'

/** Full-screen tasks (cook mode): signed in, no app chrome. */
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
    let session: SessionUser | null = null
    try {
        session = await getSession()
    } catch {
        session = null
    }
    // Same recovery as the app layout: clear a stale cookie rather than loop through /login.
    if (!session) redirect('/api/auth/signout')
    return children
}
