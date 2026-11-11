'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogClose, AlertDialogContent } from '@/components/ui/dialog'
import { IconButton } from '@/components/ui/icon-button'
import { Menu, MenuContent, MenuItem, MenuLinkItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import styles from './display.module.scss'

export interface CornerMenuIcons {
    more: ReactNode
    home: ReactNode
    fullscreen: ReactNode
    fullscreenExit: ReactNode
    unlink: ReactNode
}

function useFullscreen() {
    const [supported, setSupported] = useState(false)
    const [active, setActive] = useState(false)
    useEffect(() => {
        setSupported(document.fullscreenEnabled)
        const sync = () => setActive(document.fullscreenElement !== null)
        sync()
        document.addEventListener('fullscreenchange', sync)
        return () => document.removeEventListener('fullscreenchange', sync)
    }, [])
    const toggle = () => {
        if (document.fullscreenElement) void document.exitFullscreen()
        else void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
    }
    return { supported, active, toggle }
}

/** Kept inset from the edges: Nest Hub reserves edge swipes for the system. */
export function CornerMenu({
    icons,
    paired,
    onUnlink,
}: {
    icons: CornerMenuIcons
    paired: boolean
    onUnlink: () => Promise<void>
}) {
    const pathname = usePathname()
    const fullscreen = useFullscreen()
    const [confirm, setConfirm] = useState(false)
    const [unlinking, setUnlinking] = useState(false)
    if (!paired && !fullscreen.supported) return null

    return (
        <div className={styles.corner}>
            <Menu>
                <MenuTrigger
                    render={
                        <IconButton
                            label="Display menu"
                            icon={icons.more}
                            variant="tonal"
                            size="m"
                            className={styles.cornerButton}
                        />
                    }
                />
                <MenuContent align="end" className={styles.cornerMenu}>
                    {paired && pathname !== '/display' && (
                        <MenuLinkItem icon={icons.home} render={<Link href="/display" />}>
                            Home
                        </MenuLinkItem>
                    )}
                    {fullscreen.supported && (
                        <MenuItem
                            icon={fullscreen.active ? icons.fullscreenExit : icons.fullscreen}
                            onClick={fullscreen.toggle}
                        >
                            {fullscreen.active ? 'Exit full screen' : 'Full screen'}
                        </MenuItem>
                    )}
                    {paired && (
                        <>
                            <MenuSeparator />
                            <MenuItem icon={icons.unlink} onClick={() => setConfirm(true)}>
                                Unlink this display
                            </MenuItem>
                        </>
                    )}
                </MenuContent>
            </Menu>
            <AlertDialog open={confirm} onOpenChange={setConfirm}>
                <AlertDialogContent
                    headline="Unlink this display?"
                    actions={
                        <>
                            <AlertDialogClose render={<Button variant="text" size="m" className={styles.dialogButton} />}>
                                Cancel
                            </AlertDialogClose>
                            <Button
                                variant="text"
                                size="m"
                                className={styles.dialogButton}
                                loading={unlinking}
                                onClick={async () => {
                                    setUnlinking(true)
                                    await onUnlink()
                                    setUnlinking(false)
                                    setConfirm(false)
                                }}
                            >
                                Unlink
                            </Button>
                        </>
                    }
                >
                    It shows a new code to link again.
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
