'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useState, useTransition } from 'react'
import { checkForUpdates, installUpdate, setAutoUpdates } from '@/actions/updates'
import { Button } from '@/components/ui/button'
import { List, ListItem } from '@/components/ui/list'
import { CircularProgress } from '@/components/ui/progress'
import { useSnackbar } from '@/components/ui/snackbar'
import { Switch } from '@/components/ui/switch'
import type { UpdatesView } from '@/server/updater'
import styles from './sections.module.scss'

interface UpdatesIcons {
    current: ReactNode
    available: ReactNode
    error: ReactNode
    auto: ReactNode
    token: ReactNode
    repo: ReactNode
    external: ReactNode
    copy: ReactNode
    check: ReactNode
}

/** While the host builds a pushed update, look again this often. */
const DEPLOY_POLL_MS = 30_000

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

function CopyButton({ value, icons }: { value: string; icons: Pick<UpdatesIcons, 'copy' | 'check'> }) {
    const snackbar = useSnackbar()
    const [copied, setCopied] = useState(false)
    useEffect(() => {
        if (!copied) return
        const timer = window.setTimeout(() => setCopied(false), 2000)
        return () => window.clearTimeout(timer)
    }, [copied])
    return (
        <Button
            variant="tonal"
            icon={copied ? icons.check : icons.copy}
            aria-live="polite"
            aria-label={copied ? 'Copied' : `Copy ${value}`}
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(value)
                    setCopied(true)
                } catch {
                    snackbar({ message: "Couldn't copy. Select the name and copy it instead.", urgent: true })
                }
            }}
        >
            {copied ? 'Copied' : 'Copy'}
        </Button>
    )
}

function Setup({ view, icons }: { view: Extract<UpdatesView, { kind: 'missing' }>; icons: UpdatesIcons }) {
    return (
        <List segmented label="Updates">
            {view.needsToken && (
                <ListItem
                    className={styles.choiceRow}
                    leading={icons.token}
                    headline="Connect GitHub"
                    supporting={
                        <>
                            Save a token in your host as <code className={styles.code}>CLIPCOOK_UPDATE_TOKEN</code>
                        </>
                    }
                    trailing={
                        <span className={styles.bookmarkletActions}>
                            <Button
                                render={<a href={view.tokenUrl} target="_blank" rel="noopener noreferrer" />}
                                nativeButton={false}
                                trailingIcon={icons.external}
                            >
                                Create token
                            </Button>
                            <CopyButton value="CLIPCOOK_UPDATE_TOKEN" icons={icons} />
                        </span>
                    }
                />
            )}
            {view.needsRepo && (
                <ListItem
                    className={styles.choiceRow}
                    leading={icons.repo}
                    headline="Repository"
                    supporting={
                        <>
                            Set <code className={styles.code}>CLIPCOOK_UPDATE_REPO</code> to owner/name
                        </>
                    }
                    trailing={<CopyButton value="CLIPCOOK_UPDATE_REPO" icons={icons} />}
                />
            )}
        </List>
    )
}

function Ready({ initial, icons }: { initial: Extract<UpdatesView, { kind: 'ready' }>; icons: UpdatesIcons }) {
    const router = useRouter()
    const snackbar = useSnackbar()
    const [view, setView] = useState(initial)
    const [auto, setAuto] = useState(initial.autoUpdate)
    const [action, setAction] = useState<'check' | 'install' | null>(null)
    const [, startTransition] = useTransition()
    const { status } = view

    useEffect(() => {
        if (status.state !== 'deploying') return
        const timer = window.setInterval(() => startTransition(() => router.refresh()), DEPLOY_POLL_MS)
        return () => window.clearInterval(timer)
    }, [status.state, router])

    const run = async (kind: 'check' | 'install') => {
        setAction(kind)
        const result = await (kind === 'check' ? checkForUpdates() : installUpdate())
        setAction(null)
        if (!result.ok) {
            snackbar({ message: result.error, urgent: true })
            return
        }
        if (result.data.kind === 'ready') setView(result.data)
        if (kind === 'check' && result.data.kind === 'ready' && result.data.status.state === 'current') {
            snackbar('Up to date')
        }
    }

    const toggleAuto = async (next: boolean) => {
        setAuto(next)
        const result = await setAutoUpdates(next)
        if (!result.ok) {
            setAuto(!next)
            snackbar({ message: result.error, urgent: true })
        }
    }

    let row: ReactNode
    if (status.state === 'available') {
        const detail = status.commits
            ? `${status.commits} ${status.commits === 1 ? 'change' : 'changes'}`
            : 'New version'
        row = (
            <>
                <ListItem
                    leading={icons.available}
                    headline="Update available"
                    supporting={
                        view.lastError ??
                        (status.upstreamDate ? `${detail} · ${shortDate(status.upstreamDate)}` : detail)
                    }
                    trailing={
                        <Button
                            loading={action === 'install'}
                            disabled={action !== null}
                            onClick={() => run('install')}
                        >
                            Update
                        </Button>
                    }
                />
                <ListItem
                    href={status.compareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    leading={icons.repo}
                    headline="What's new"
                    trailing={icons.external}
                />
            </>
        )
    } else if (status.state === 'deploying') {
        row = (
            <ListItem
                leading={icons.available}
                headline="Installing update"
                supporting="Your host is building it"
                trailing={<CircularProgress size={32} label="Installing update" />}
            />
        )
    } else {
        const failed = status.state === 'error'
        row = (
            <ListItem
                leading={failed ? icons.error : icons.current}
                headline={failed ? "Couldn't check for updates" : 'Up to date'}
                // The button already says to try again.
                supporting={failed ? status.message.replace(/ Try again\.$/, '') : (view.lastError ?? undefined)}
                trailing={
                    <Button
                        variant="text"
                        loading={action === 'check'}
                        disabled={action !== null}
                        onClick={() => run('check')}
                    >
                        {failed ? 'Try again' : 'Check'}
                    </Button>
                }
            />
        )
    }

    return (
        <List segmented label="Updates">
            {row}
            <ListItem
                as="label"
                leading={icons.auto}
                headline="Auto update"
                supporting="Daily"
                trailing={<Switch checked={auto} onCheckedChange={(next) => void toggleAuto(next)} />}
            />
        </List>
    )
}

export function UpdatesSection({ view, icons }: { view: UpdatesView; icons: UpdatesIcons }) {
    if (view.kind === 'missing') return <Setup view={view} icons={icons} />
    // A fresh server render (refresh while deploying, navigation) starts from its own data.
    return <Ready key={JSON.stringify(view)} initial={view} icons={icons} />
}
