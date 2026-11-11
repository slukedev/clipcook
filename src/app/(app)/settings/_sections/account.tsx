'use client'

import { type ReactNode, useTransition } from 'react'
import { signOut } from '@/actions/auth'
import { Avatar } from '@/components/ui/avatar'
import { List, ListItem } from '@/components/ui/list'
import { LoadingIndicator } from '@/components/ui/loading-indicator'
import { useSessionUser } from '../../_shell/session-context'

export function AccountSection({ icons }: { icons: { signOut: ReactNode } }) {
    const user = useSessionUser()
    const [pending, startTransition] = useTransition()
    const name = user.name ?? 'Cook'
    return (
        <List segmented label="Account">
            <ListItem
                leading={<Avatar name={name} src={user.picture} size={40} />}
                headline={name}
                supporting={user.email ?? undefined}
            />
            <ListItem
                leading={icons.signOut}
                headline="Sign out"
                disabled={pending}
                trailing={pending ? <LoadingIndicator size={32} label="Signing out" /> : undefined}
                onClick={() => startTransition(() => signOut())}
            />
        </List>
    )
}
