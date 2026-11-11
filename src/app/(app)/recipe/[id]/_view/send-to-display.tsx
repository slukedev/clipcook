'use client'

import Link from 'next/link'
import { type ReactNode, useState, useTransition } from 'react'
import { sendToDisplay } from '@/actions/displays'
import { DisplayLabel, sentMessage, sortByPresence } from '@/components/kitchen/display-presence'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { IconButton } from '@/components/ui/icon-button'
import { Menu, MenuContent, MenuGroup, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { useSnackbar } from '@/components/ui/snackbar'
import { Tooltip } from '@/components/ui/tooltip'
import { recipeScale } from '@/lib/cook/recipe-state'
import { readJson, writeJson } from '@/lib/cook/storage'
import type { DisplayOption } from './types'

const LAST_DISPLAY = 'cc:last-display'

export function rememberDisplay(id: string) {
    writeJson('local', LAST_DISPLAY, id)
}

export function lastDisplay(displays: readonly DisplayOption[]): DisplayOption | undefined {
    const id = readJson<string | null>('local', LAST_DISPLAY, null)
    return displays.find((d) => d.id === id) ?? displays[0]
}

/**
 * Puts this recipe on a paired kitchen display. No displays: explains and links to setup.
 * One: a single tap. Several: a menu with each screen's state, the ones that are on first.
 * `castSlot` is where the optional Google Cast button goes when Cast is configured.
 */
export function SendToDisplay({
    recipeId,
    displays,
    icons,
    castSlot,
}: {
    recipeId: string
    displays: DisplayOption[]
    icons: { cast: ReactNode; castConnected: ReactNode; tv: ReactNode }
    castSlot?: ReactNode
}) {
    const snackbar = useSnackbar()
    const [pending, startTransition] = useTransition()
    const [explain, setExplain] = useState(false)
    // Read when the menu opens, so "Active now" is true at the moment someone picks.
    const [now, setNow] = useState(0)
    const showing = displays.some((d) => d.current?.recipeId === recipeId)

    const send = (display: DisplayOption) => {
        if (pending) return
        startTransition(async () => {
            const result = await sendToDisplay(display.id, {
                recipeId,
                step: null,
                scale: recipeScale.get(recipeId),
            })
            if (!result.ok) {
                snackbar({ message: result.error, urgent: true })
                return
            }
            rememberDisplay(display.id)
            snackbar(sentMessage(display, Date.now()))
        })
    }

    const icon = showing ? icons.castConnected : icons.cast

    let control: ReactNode
    if (displays.length === 0) {
        control = (
            <>
                <Tooltip content="Send to display">
                    <IconButton label="Send to display" icon={icon} onClick={() => setExplain(true)} />
                </Tooltip>
                <Dialog open={explain} onOpenChange={setExplain}>
                    <DialogContent
                        headline="Send to a display"
                        icon={icons.tv}
                        actions={
                            <>
                                <DialogClose render={<Button variant="text" />}>Not now</DialogClose>
                                <Button variant="text" render={<Link href="/settings/displays" />} nativeButton={false}>
                                    Set up a display
                                </Button>
                            </>
                        }
                    >
                        Pair a tablet, Echo Show or Nest Hub once, then send recipes to it from here.
                    </DialogContent>
                </Dialog>
            </>
        )
    } else if (displays.length === 1) {
        const only = displays[0] as DisplayOption
        control = (
            <Tooltip content={`Show on ${only.name}`}>
                <IconButton
                    label={`Show on ${only.name}`}
                    icon={icon}
                    aria-busy={pending || undefined}
                    onClick={() => send(only)}
                />
            </Tooltip>
        )
    } else {
        const last = lastDisplay(displays)
        control = (
            <Menu onOpenChange={(open) => open && setNow(Date.now())}>
                <MenuTrigger render={<IconButton label="Send to display" icon={icon} />} />
                <MenuContent align="end">
                    <MenuGroup label="Show on">
                        {sortByPresence(displays).map((d) => (
                            <MenuItem key={d.id} icon={icons.tv} selected={d.id === last?.id} onClick={() => send(d)}>
                                <DisplayLabel display={d} now={now} />
                            </MenuItem>
                        ))}
                    </MenuGroup>
                </MenuContent>
            </Menu>
        )
    }

    return (
        <>
            {castSlot}
            {control}
        </>
    )
}
