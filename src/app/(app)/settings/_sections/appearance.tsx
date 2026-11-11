'use client'

import { type ReactNode, useSyncExternalStore } from 'react'
import { ConnectedButtonGroup, ConnectedButtonGroupItem } from '@/components/ui/button-group'
import { List, ListItem } from '@/components/ui/list'
import { useThemePreference } from '@/components/theme/theme-provider'
import type { Contrast, ThemeMode } from '@/lib/theme/preference'
import { type MotionPreference, MOTION_KEY, readMotion, saveMotion } from '../../_shell/preferences'
import styles from './sections.module.scss'

interface AppearanceProps {
    icons: { theme: ReactNode; contrast: ReactNode; motion: ReactNode }
}

const motionListeners = new Set<() => void>()

function subscribeMotion(listener: () => void) {
    motionListeners.add(listener)
    const onStorage = (event: StorageEvent) => {
        if (event.key === MOTION_KEY) listener()
    }
    window.addEventListener('storage', onStorage)
    return () => {
        motionListeners.delete(listener)
        window.removeEventListener('storage', onStorage)
    }
}

function useMotionPreference(): [MotionPreference, (value: MotionPreference) => void] {
    const value = useSyncExternalStore(subscribeMotion, readMotion, () => 'expressive' as const)
    const set = (next: MotionPreference) => {
        saveMotion(next)
        for (const listener of motionListeners) listener()
    }
    return [value, set]
}

/** A row whose control drops under its label on narrow windows. */
function ChoiceRow<T extends string>({
    icon,
    label,
    value,
    options,
    onChange,
}: {
    icon: ReactNode
    label: string
    value: T
    options: { value: T; label: string }[]
    onChange: (value: T) => void
}) {
    return (
        <ListItem
            className={styles.choiceRow}
            leading={icon}
            headline={<span aria-hidden>{label}</span>}
            trailing={
                <ConnectedButtonGroup
                    label={label}
                    value={[value]}
                    onValueChange={(next) => {
                        const picked = next[0] as T | undefined
                        if (picked && picked !== value) onChange(picked)
                    }}
                    className={styles.group}
                    fill
                >
                    {options.map((option) => (
                        <ConnectedButtonGroupItem key={option.value} value={option.value}>
                            {option.label}
                        </ConnectedButtonGroupItem>
                    ))}
                </ConnectedButtonGroup>
            }
        />
    )
}

export function AppearanceSection({ icons }: AppearanceProps) {
    const { theme, contrast, setTheme, setContrast } = useThemePreference()
    const [motion, setMotion] = useMotionPreference()
    return (
        <List segmented label="Appearance">
            <ChoiceRow<ThemeMode>
                icon={icons.theme}
                label="Theme"
                value={theme}
                onChange={setTheme}
                options={[
                    { value: 'system', label: 'System' },
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                ]}
            />
            <ChoiceRow<Contrast>
                icon={icons.contrast}
                label="Contrast"
                value={contrast}
                onChange={setContrast}
                options={[
                    { value: 'standard', label: 'Standard' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                ]}
            />
            <ChoiceRow<MotionPreference>
                icon={icons.motion}
                label="Motion"
                value={motion}
                onChange={setMotion}
                options={[
                    { value: 'expressive', label: 'Expressive' },
                    { value: 'standard', label: 'Standard' },
                ]}
            />
        </List>
    )
}
