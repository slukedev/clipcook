import type { Metadata, Viewport } from 'next'
import { Google_Sans_Flex } from 'next/font/google'
import { headers } from 'next/headers'
import { ServiceWorkerRegister } from '@/components/service-worker-register'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { SnackbarProvider } from '@/components/ui/snackbar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { THEME_BOOTSTRAP } from '@/lib/theme/bootstrap'
import { schemeFromSeed } from '@/lib/theme/scheme'
import { BRAND_SEED } from '@/lib/theme/seed'
import { getThemePreference } from '@/lib/theme/server'
import '@/styles/globals.scss'

const googleSansFlex = Google_Sans_Flex({
    subsets: ['latin', 'latin-ext'],
    display: 'swap',
    variable: '--font-google-sans-flex',
    axes: ['GRAD', 'ROND', 'opsz', 'wdth'],
})

export const metadata: Metadata = {
    title: {
        default: 'ClipCook',
        template: '%s · ClipCook',
    },
    description: 'Clip recipes from anywhere, keep them, and cook from them.',
    applicationName: 'ClipCook',
    icons: {
        icon: '/favicon.ico',
        apple: '/apple-touch-icon.png',
    },
    formatDetection: { telephone: false },
    appleWebApp: { capable: true, statusBarStyle: 'default', title: 'ClipCook' },
}

const lightSurface = schemeFromSeed(BRAND_SEED).surface
const darkSurface = schemeFromSeed(BRAND_SEED, { dark: true }).surface

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    interactiveWidget: 'resizes-content',
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: lightSurface ?? '#ffffff' },
        { media: '(prefers-color-scheme: dark)', color: darkSurface ?? '#000000' },
    ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const [headerList, preference] = await Promise.all([headers(), getThemePreference()])
    const nonce = headerList.get('x-nonce') ?? undefined
    return (
        <html
            lang="en"
            dir="ltr"
            className={googleSansFlex.variable}
            data-theme={preference.theme === 'system' ? undefined : preference.theme}
            data-contrast={preference.contrast === 'standard' ? undefined : preference.contrast}
            suppressHydrationWarning
        >
            <head>
                {/* Browsers blank the nonce attribute on DOM reads (CSP), so the client sees "". */}
                {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static pre-paint theme script */}
                <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
            </head>
            <body>
                <ThemeProvider initial={preference}>
                    <TooltipProvider>
                        <SnackbarProvider>{children}</SnackbarProvider>
                    </TooltipProvider>
                </ThemeProvider>
                <ServiceWorkerRegister />
            </body>
        </html>
    )
}
