'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useState, useTransition } from 'react'
import { checkForUpdates, installUpdate, setAutoUpdates } from '@/actions/updates'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogClose, AlertDialogContent } from '@/components/ui/dialog'
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

const replacedNote = (count: number) => `Last update replaced ${count === 1 ? '1 file' : `${count} files`} changed here`

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
            {view.needsBranch && (
                <ListItem
                    leading={icons.repo}
                    headline="Branch"
                    supporting={
                        <>
                            <code className={styles.code}>CLIPCOOK_UPDATE_BRANCH</code> isn't a valid branch name
                        </>
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
    const [confirm, setConfirm] = useState(false)
    const [, startTransition] = useTransition()
    const { status } = view

    useEffect(() => {
        if (status.state !== 'deploying') return
        const timer = window.setInterval(() => startTransition(() => router.refresh()), DEPLOY_POLL_MS)
        return () => window.clearInterval(timer)
    }, [status.state, router])

    const run = async (kind: 'check' | 'install') => {
        setConfirm(false)
        setAction(kind)
        try {
            const result = await (kind === 'check' ? checkForUpdates() : installUpdate())
            if (!result.ok) {
                snackbar({ message: result.error, urgent: true })
                return
            }
            if (result.data.kind === 'ready') setView(result.data)
            if (kind === 'check' && result.data.kind === 'ready' && result.data.status.state === 'current') {
                snackbar('Up to date')
            }
        } catch {
            // The action never answered: offline, timed out, or a new deployment took over.
            snackbar({ message: "Couldn't reach ClipCook. Refresh and try again.", urgent: true })
        } finally {
            setAction(null)
        }
    }

    const toggleAuto = async (next: boolean) => {
        setAuto(next)
        let error: string | null = null
        try {
            const result = await setAutoUpdates(next)
            if (!result.ok) error = result.error
        } catch {
            error = "Couldn't reach ClipCook. Try again."
        }
        if (error) {
            setAuto(!next)
            snackbar({ message: error, urgent: true })
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
                            onClick={() => (status.review ? setConfirm(true) : run('install'))}
                        >
                            Update
                        </Button>
                    }
                />
                <AlertDialog open={confirm} onOpenChange={setConfirm}>
                    <AlertDialogContent
                        headline="Replace Changed Files?"
                        actions={
                            <>
                                <AlertDialogClose render={<Button variant="text" />}>Cancel</AlertDialogClose>
                                <Button variant="text" onClick={() => run('install')}>
                                    Update
                                </Button>
                            </>
                        }
                    >
                        {status.replaces === 1 ? '1 file differs' : `${status.replaces} files differ`} from ClipCook and
                        will be replaced or removed. Your repository's history keeps the old versions.
                    </AlertDialogContent>
                </AlertDialog>
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
                supporting={
                    failed
                        ? status.message.replace(/ Try again\.$/, '')
                        : (view.lastError ?? (view.lastReplaced > 0 ? replacedNote(view.lastReplaced) : undefined))
                }
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
    // A fresh server render with different data starts over; the check time alone doesn't count.
    const { checkedAt: _checkedAt, ...status } = view.status
    return <Ready key={JSON.stringify({ ...view, status })} initial={view} icons={icons} />
}
