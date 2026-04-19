import { redirect } from 'next/navigation'
import { getSession } from '@/server/auth'
import { Topnav } from '@/components/topnav'
import { SessionProvider } from './session-context'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession()
    if (!session) redirect('/login')

    return (
        <SessionProvider user={session}>
            <Topnav photoUrl={session.picture ?? undefined} />
            {children}
        </SessionProvider>
    )
}
