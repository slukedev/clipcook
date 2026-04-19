import type { Metadata, Viewport } from 'next'
import { Roboto } from 'next/font/google'
import { ServiceWorkerRegister } from '@/components/service-worker-register'
import '@/styles/globals.scss'

const roboto = Roboto({
    subsets: ['latin'],
    weight: ['100', '300', '400', '500', '700', '900'],
    style: ['normal', 'italic'],
    display: 'swap',
    variable: '--font-roboto',
})

export const metadata: Metadata = {
    title: 'ClipCook',
    description: 'A recipe clipper, based on the Material You design system!',
    icons: {
        icon: '/favicon.ico',
        apple: '/apple-touch-icon.png',
    },
    manifest: '/manifest.json',
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#D0BCFF',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={roboto.variable}>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                {/* eslint-disable-next-line @next/next/no-page-custom-font */}
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
                />
            </head>
            <body>
                {children}
                <ServiceWorkerRegister />
            </body>
        </html>
    )
}
