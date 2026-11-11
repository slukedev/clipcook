'use client'

import type { ReactNode } from 'react'
import { useThemePreference } from '@/components/theme/theme-provider'
import { ConnectedButtonGroup, ConnectedButtonGroupItem } from '@/components/ui/button-group'
import { List, ListItem } from '@/components/ui/list'
import type { Contrast, MotionMode, ThemeMode } from '@/lib/theme/preference'
import styles from './sections.module.scss'

interface AppearanceProps {
    icons: { theme: ReactNode; contrast: ReactNode; motion: ReactNode }
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
    const { theme, contrast, motion, setTheme, setContrast, setMotion } = useThemePreference()
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
            <ChoiceRow<MotionMode>
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
