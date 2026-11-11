import type { Metadata, Viewport } from 'next'
import { Icon } from '@/components/ui/icon'
import { schemeDeclarations, schemeFromSeed } from '@/lib/theme/scheme'
import { BRAND_PRIMARY_CHROMA, BRAND_SEED } from '@/lib/theme/seed'
import { getDisplaySession } from '@/server/display-auth'
import { DisplayProvider } from './display-provider'
import styles from './display.module.scss'

export const metadata: Metadata = {
    title: 'Kitchen display',
    robots: { index: false, follow: false },
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'ClipCook' },
}

// Displays live on a counter all day: always dark, so they glow less and burn in less.
const brandDark = schemeFromSeed(BRAND_SEED, { dark: true, primaryChroma: BRAND_PRIMARY_CHROMA })
const DISPLAY_CSS = `[data-display-root] {\n${schemeDeclarations(brandDark)}\n    color-scheme: dark;\n}\nhtml:has([data-display-root]), body:has([data-display-root]) {\n    background-color: ${brandDark.surface};\n}`

export const viewport: Viewport = {
    themeColor: brandDark.surface ?? '#1a1110',
    colorScheme: 'dark',
}

export default async function DisplayLayout({ children }: { children: React.ReactNode }) {
    const display = await getDisplaySession()
    return (
        <div data-display-root="" className={styles.root}>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: generated color tokens, no user input */}
            <style dangerouslySetInnerHTML={{ __html: DISPLAY_CSS }} />
            <DisplayProvider
                paired={display !== null}
                icons={{
                    more: <Icon name="more_vert" />,
                    home: <Icon name="home" />,
                    fullscreen: <Icon name="fullscreen" />,
                    fullscreenExit: <Icon name="fullscreen_exit" />,
                    unlink: <Icon name="logout" />,
                }}
            >
                {children}
            </DisplayProvider>
        </div>
    )
}
