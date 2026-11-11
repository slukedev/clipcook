'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useState, useTransition } from 'react'
import { ConnectedButtonGroup, ConnectedButtonGroupItem } from '@/components/ui/button-group'
import { List, ListItem } from '@/components/ui/list'
import { WEEK_START_COOKIE, type WeekStart } from '@/lib/plan/week'
import { writeCookie } from '../../_shell/preferences'
import styles from './sections.module.scss'

/** Which day the meal plan's weeks begin on. */
export function WeekStartRow({ initial, icon }: { initial: WeekStart; icon: ReactNode }) {
    const router = useRouter()
    const [value, setValue] = useState(initial)
    const [, startTransition] = useTransition()
    return (
        <List segmented label="Meal plan">
            <ListItem
                className={styles.choiceRow}
                leading={icon}
                headline={<span aria-hidden>Week starts on</span>}
                trailing={
                    <ConnectedButtonGroup
                        label="Week starts on"
                        value={[value]}
                        onValueChange={(next) => {
                            const picked = next[0] as WeekStart | undefined
                            if (!picked || picked === value) return
                            setValue(picked)
                            writeCookie(WEEK_START_COOKIE, picked)
                            startTransition(() => router.refresh())
                        }}
                        className={styles.group}
                        fill
                    >
                        <ConnectedButtonGroupItem value="monday">Monday</ConnectedButtonGroupItem>
                        <ConnectedButtonGroupItem value="sunday">Sunday</ConnectedButtonGroupItem>
                    </ConnectedButtonGroup>
                }
            />
        </List>
    )
}
