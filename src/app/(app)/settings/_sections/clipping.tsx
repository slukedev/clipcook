'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { List, ListItem } from '@/components/ui/list'
import { useSnackbar } from '@/components/ui/snackbar'
import { bookmarkletHref } from '@/lib/domain/bookmarklet'
import { promptInstall, useInstallState } from '../../_shell/install-prompt'
import styles from './sections.module.scss'

interface ClippingProps {
    origin: string
    icons: { bookmarklet: ReactNode; copy: ReactNode; check: ReactNode; install: ReactNode; share: ReactNode }
}

export function ClippingSection({ origin, icons }: ClippingProps) {
    const snackbar = useSnackbar()
    const linkRef = useRef<HTMLAnchorElement>(null)
    const [copied, setCopied] = useState(false)
    const install = useInstallState()
    const href = bookmarkletHref(origin)

    // React refuses javascript: URLs in JSX, so the bookmarklet gets its href directly.
    useEffect(() => {
        linkRef.current?.setAttribute('href', href)
    }, [href])

    useEffect(() => {
        if (!copied) return
        const timer = window.setTimeout(() => setCopied(false), 2000)
        return () => window.clearTimeout(timer)
    }, [copied])

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(href)
            setCopied(true)
        } catch {
            snackbar({ message: "Couldn't copy. Long-press the button to copy its link instead.", urgent: true })
        }
    }

    return (
        <List segmented label="Clipping">
            <ListItem
                className={styles.choiceRow}
                leading={icons.bookmarklet}
                headline="Bookmarklet"
                supporting={
                    <>
                        <span className={styles.pointerFine}>Drag the button to your bookmarks bar.</span>
                        <span className={styles.pointerCoarse}>Copy it, then paste it as a bookmark's address.</span>
                    </>
                }
                trailing={
                    <span className={styles.bookmarkletActions}>
                        {/* biome-ignore lint/a11y/useValidAnchor: a bookmarklet must be a real link to be draggable */}
                        <a
                            ref={linkRef}
                            href="#bookmarklet"
                            className={styles.bookmarklet}
                            onClick={(event) => {
                                event.preventDefault()
                                snackbar('Drag it to your bookmarks bar')
                            }}
                        >
                            {icons.bookmarklet}
                            Clip to ClipCook
                        </a>
                        <Button
                            variant="tonal"
                            icon={copied ? icons.check : icons.copy}
                            onClick={copy}
                            aria-live="polite"
                        >
                            {copied ? 'Copied' : 'Copy'}
                        </Button>
                    </span>
                }
            />
            {install === 'available' && (
                <ListItem
                    leading={icons.install}
                    headline="Install app"
                    supporting="Share recipes to ClipCook from other apps"
                    trailing={
                        <Button
                            variant="tonal"
                            onClick={async () => {
                                if (await promptInstall()) snackbar('Installed')
                            }}
                        >
                            Install
                        </Button>
                    }
                />
            )}
            {install === 'ios' && (
                <ListItem
                    leading={icons.share}
                    headline="Add to Home Screen"
                    supporting="Tap Share, then Add to Home Screen"
                />
            )}
        </List>
    )
}
