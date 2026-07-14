import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Roboto_Flex } from 'next/font/google'
import { ServiceWorkerRegister } from '@/components/service-worker-register'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { THEME_COOKIE } from '@/lib/theme/preference'
import '@/styles/globals.scss'

const robotoFlex = Roboto_Flex({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-roboto-flex',
    axes: ['opsz', 'wdth', 'GRAD'],
})

export const metadata: Metadata = {
    title: {
        default: 'ClipCook',
        template: '%s · ClipCook',
    },
    description: 'Clip, keep, and cook your favorite recipes.',
    icons: {
        icon: '/favicon.ico',
        apple: '/apple-touch-icon.png',
    },
    manifest: '/manifest.json',
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#fdf7ff' },
        { media: '(prefers-color-scheme: dark)', color: '#141218' },
    ],
}

// Resolves the theme before first paint: explicit cookie choice wins,
// otherwise the OS preference. Kept inline so it blocks paint, not load.
const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);var t=m?m[1]:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}})()`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const nonce = (await headers()).get('x-nonce') ?? undefined
    return (
        <html lang="en" className={robotoFlex.variable} suppressHydrationWarning>
            <head>
                {/* Browsers blank the nonce attribute on DOM reads (CSP spec), so the
                    client always sees "" — suppress that known-benign hydration diff. */}
                {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static pre-paint theme resolution */}
                <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeScript }} />
            </head>
            <body>
                <ThemeProvider>{children}</ThemeProvider>
                <ServiceWorkerRegister />
            </body>
        </html>
    )
}
