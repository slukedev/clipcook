'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTransition } from 'react'
import { useTheme } from '@/components/theme/theme-provider'
import { Avatar, Icon, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, TopAppBar, cx } from '@/components/ui'
import type { ThemePreference } from '@/lib/theme/preference'
import { signOutAction } from '../login/actions'
import { useSessionUser } from './session-context'
import styles from './app-bar.module.scss'

const THEME_OPTIONS: Array<{
    value: ThemePreference
    label: string
    icon: 'light_mode' | 'dark_mode' | 'brightness_auto'
}> = [
    { value: 'light', label: 'Light', icon: 'light_mode' },
    { value: 'dark', label: 'Dark', icon: 'dark_mode' },
    { value: 'system', label: 'Match device', icon: 'brightness_auto' },
]

export function AppBar() {
    const user = useSessionUser()
    const { preference, setPreference } = useTheme()
    const [, startTransition] = useTransition()

    return (
        <TopAppBar
            leading={
                <Link href="/" className={styles.brand} aria-label="ClipCook home">
                    <Image src="/logo.webp" alt="" width={28} height={28} className={styles.logo} />
                    <span className={styles.wordmark}>ClipCook</span>
                </Link>
            }
            title=""
            trailing={
                <Menu>
                    <MenuTrigger
                        render={
                            <button type="button" className={styles.avatarButton} aria-label="Account and settings">
                                <Avatar src={user.picture} name={user.name ?? user.email ?? 'You'} />
                            </button>
                        }
                    />
                    <MenuContent>
                        <div className={styles.accountHeader}>
                            <span className={styles.accountName}>{user.name ?? 'Signed in'}</span>
                            {user.email && <span className={styles.accountEmail}>{user.email}</span>}
                        </div>
                        <MenuSeparator />
                        {THEME_OPTIONS.map((option) => (
                            <MenuItem
                                key={option.value}
                                icon={option.icon}
                                closeOnClick={false}
                                onClick={() => setPreference(option.value)}
                                className={cx(preference === option.value && styles.activeTheme)}
                            >
                                <span className={styles.themeLabel}>
                                    {option.label}
                                    {preference === option.value && <Icon name="check" size={18} />}
                                </span>
                            </MenuItem>
                        ))}
                        <MenuSeparator />
                        <MenuItem
                            icon="logout"
                            onClick={() => {
                                startTransition(async () => {
                                    await signOutAction()
                                })
                            }}
                        >
                            Sign out
                        </MenuItem>
                    </MenuContent>
                </Menu>
            }
        />
    )
}
