import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { getSession, type SessionUser } from '@/server/auth'
import { getGroceryList } from '@/server/queries'
import { AppShell, type ClipAction, type Destination } from './_shell/app-shell'
import { RAIL_COOKIE } from './_shell/preferences'
import { SessionProvider } from './_shell/session-context'

const CLIP_ACTIONS: ClipAction[] = [
    { href: '/clip?mode=link', label: 'From a link', icon: <Icon name="link" /> },
    { href: '/clip?mode=text', label: 'Paste text', icon: <Icon name="content_paste" /> },
    { href: '/new', label: 'Write one', icon: <Icon name="edit" /> },
]

async function uncheckedGroceries(uid: string): Promise<number> {
    try {
        return (await getGroceryList(uid)).reduce((n, item) => (item.checked ? n : n + 1), 0)
    } catch {
        // A badge is not worth failing the whole app over.
        return 0
    }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    let session: SessionUser | null
    try {
        session = await getSession()
    } catch {
        // A legacy cookie whose verification fails outright counts as signed out.
        session = null
    }
    // The proxy only lets requests with a session cookie through, so a missing session
    // here means a stale cookie. Clear it rather than bounce between here and /login.
    if (!session) redirect('/api/auth/signout')

    const [groceryCount, jar] = await Promise.all([uncheckedGroceries(session.uid), cookies()])
    const destinations: Destination[] = [
        {
            href: '/',
            label: 'Library',
            icon: <Icon name="menu_book" />,
            selectedIcon: <Icon name="menu_book" filled />,
        },
        {
            href: '/collections',
            label: 'Collections',
            icon: <Icon name="collections_bookmark" />,
            selectedIcon: <Icon name="collections_bookmark" filled />,
        },
        {
            href: '/plan',
            label: 'Plan',
            icon: <Icon name="calendar_month" />,
            selectedIcon: <Icon name="calendar_month" filled />,
        },
        {
            href: '/grocery',
            label: 'Grocery',
            icon: <Icon name="shopping_basket" />,
            selectedIcon: <Icon name="shopping_basket" filled />,
            badge: groceryCount,
        },
        {
            href: '/settings',
            label: 'Settings',
            icon: <Icon name="settings" />,
            selectedIcon: <Icon name="settings" filled />,
        },
    ]

    return (
        <SessionProvider user={session}>
            <AppShell
                destinations={destinations}
                clipActions={CLIP_ACTIONS}
                clipIcon={<Icon name="add" />}
                railExpanded={jar.get(RAIL_COOKIE)?.value !== 'collapsed'}
            >
                {children}
            </AppShell>
        </SessionProvider>
    )
}
