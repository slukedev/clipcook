import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { StatusScreen } from './_status/status-screen'

export const metadata: Metadata = { title: 'Page Not Found' }

export default function NotFound() {
    return (
        <main>
            <StatusScreen
                fullscreen
                shape="cookie12"
                icon={<Icon name="search_off" />}
                title="Page Not Found"
                action={
                    <Button size="m" render={<Link href="/" />} nativeButton={false}>
                        Go to library
                    </Button>
                }
            />
        </main>
    )
}
