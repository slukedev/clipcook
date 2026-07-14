import { redirect } from 'next/navigation'
import { SnackbarProvider } from '@/components/ui'
import { getSession } from '@/server/auth'
import { AppBar } from './app-bar'
import { SessionProvider } from './session-context'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession()
    if (!session) redirect('/login')

    return (
        <SessionProvider user={session}>
            <SnackbarProvider>
                <AppBar />
                {children}
            </SnackbarProvider>
        </SessionProvider>
    )
}
