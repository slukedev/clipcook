'use client'

import { useState } from 'react'
import { useThemePreference } from '@/components/theme/theme-provider'
import { ConnectedButtonGroup, ConnectedButtonGroupItem } from '@/components/ui/button-group'
import { Select } from '@/components/ui/select'
import { Shape } from '@/components/ui/shape'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import { useMotionScheme } from '@/lib/motion'
import type { Contrast, ThemeMode } from '@/lib/theme/preference'
import { dynamicColorCss, type SchemeVariant } from '@/lib/theme/scheme'
import styles from './gallery.module.scss'
import { SECTIONS } from './sections'

const FOOD_SEEDS = [
    { name: 'Tomato', hex: '#C8321E' },
    { name: 'Basil', hex: '#4E7A2C' },
    { name: 'Curry', hex: '#D9A21B' },
    { name: 'Chocolate', hex: '#5B3A29' },
    { name: 'Blueberry', hex: '#3C4E8C' },
    { name: 'Bread', hex: '#D8C3A0' },
]

export function Gallery() {
    const theme = useThemePreference()
    const motion = useMotionScheme()
    const [seed, setSeed] = useState<string | null>(null)
    const [variant, setVariant] = useState<SchemeVariant>('content')

    const css = seed ? dynamicColorCss('.cc-gallery-dynamic', seed, { contrast: theme.contrast, variant }) : ''

    return (
        <div className={styles.page}>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: generated color tokens only */}
            {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
            <div className={styles.controls}>
                <span className={styles.brand}>
                    <Shape name="cookie9" size={28} className={styles.brandShape} />
                    Gallery
                </span>
                <div className={styles.controlGroup}>
                    <span className={styles.controlLabel}>Theme</span>
                    <ConnectedButtonGroup
                        size="xs"
                        label="Theme"
                        value={[theme.theme]}
                        onValueChange={(v) => v[0] && theme.setTheme(v[0] as ThemeMode)}
                    >
                        <ConnectedButtonGroupItem size="xs" value="system">
                            Auto
                        </ConnectedButtonGroupItem>
                        <ConnectedButtonGroupItem size="xs" value="light">
                            Light
                        </ConnectedButtonGroupItem>
                        <ConnectedButtonGroupItem size="xs" value="dark">
                            Dark
                        </ConnectedButtonGroupItem>
                    </ConnectedButtonGroup>
                </div>
                <div className={styles.controlGroup}>
                    <span className={styles.controlLabel}>Contrast</span>
                    <ConnectedButtonGroup
                        size="xs"
                        label="Contrast"
                        value={[theme.contrast]}
                        onValueChange={(v) => v[0] && theme.setContrast(v[0] as Contrast)}
                    >
                        <ConnectedButtonGroupItem size="xs" value="standard">
                            Standard
                        </ConnectedButtonGroupItem>
                        <ConnectedButtonGroupItem size="xs" value="medium">
                            Medium
                        </ConnectedButtonGroupItem>
                        <ConnectedButtonGroupItem size="xs" value="high">
                            High
                        </ConnectedButtonGroupItem>
                    </ConnectedButtonGroup>
                </div>
                <div className={styles.controlGroup}>
                    <span className={styles.controlLabel}>Motion</span>
                    <ConnectedButtonGroup
                        size="xs"
                        label="Motion scheme"
                        value={[motion]}
                        onValueChange={(v) => {
                            if (v[0] === 'standard') document.documentElement.dataset.motion = 'standard'
                            else if (v[0]) delete document.documentElement.dataset.motion
                        }}
                    >
                        <ConnectedButtonGroupItem size="xs" value="expressive">
                            Expressive
                        </ConnectedButtonGroupItem>
                        <ConnectedButtonGroupItem size="xs" value="standard">
                            Standard
                        </ConnectedButtonGroupItem>
                    </ConnectedButtonGroup>
                </div>
                <div className={styles.controlGroup}>
                    <span className={styles.controlLabel}>Recipe color</span>
                    <div className={styles.seeds}>
                        <button
                            type="button"
                            className={styles.seed}
                            aria-pressed={seed === null}
                            aria-label="Brand color"
                            style={{ background: 'var(--md-sys-color-primary)' }}
                            onClick={() => setSeed(null)}
                        />
                        {FOOD_SEEDS.map((s) => (
                            <button
                                key={s.hex}
                                type="button"
                                className={styles.seed}
                                aria-pressed={seed === s.hex}
                                aria-label={s.name}
                                title={s.name}
                                style={{ background: s.hex }}
                                onClick={() => setSeed(s.hex)}
                            />
                        ))}
                        <input
                            type="color"
                            className={styles.colorInput}
                            aria-label="Custom seed"
                            value={seed ?? '#c2502a'}
                            onChange={(e) => setSeed(e.target.value)}
                        />
                    </div>
                    <Select
                        label="Scheme"
                        variant="outlined"
                        value={variant}
                        onValueChange={(v) => v && setVariant(v)}
                        options={[
                            { value: 'content', label: 'Content' },
                            { value: 'tonalSpot', label: 'Tonal spot' },
                            { value: 'vibrant', label: 'Vibrant' },
                            { value: 'expressive', label: 'Expressive' },
                        ]}
                    />
                </div>
            </div>
            <div className={`${styles.layout} cc-gallery-dynamic`}>
                <nav className={styles.toc} aria-label="Sections">
                    {SECTIONS.map((s) => (
                        <a key={s.id} href={`#${s.id}`}>
                            {s.title}
                        </a>
                    ))}
                </nav>
                <main className={styles.sections}>
                    <h1>
                        <VisuallyHidden>Design system gallery</VisuallyHidden>
                    </h1>
                    {SECTIONS.map(({ id, title, Component }) => (
                        <section key={id} id={id} className={styles.section} aria-labelledby={`${id}-title`}>
                            <h2 id={`${id}-title`} className={styles.sectionTitle}>
                                {title}
                            </h2>
                            <Component />
                        </section>
                    ))}
                </main>
            </div>
        </div>
    )
}
