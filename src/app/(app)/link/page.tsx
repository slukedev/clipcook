import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/ui/icon'
import { IconButton } from '@/components/ui/icon-button'
import { TopAppBar } from '@/components/ui/top-app-bar'
import { PageTransition } from '@/components/ui/view-transition'
import { requireSession } from '@/server/auth'
import { listDisplays } from '@/server/queries'
import { requestOrigin } from '../settings/_sections/origin'
import { CODE_LENGTH, normalizeCode } from './code'
import { LinkForm } from './link-form'
import styles from './link.module.scss'

export const metadata: Metadata = { title: 'Link a Display' }

export default async function LinkPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
    const [{ code }, session, origin] = await Promise.all([searchParams, requireSession(), requestOrigin()])
    const taken = (await listDisplays(session.uid)).map((d) => d.name)
    const initialCode = normalizeCode(Array.isArray(code) ? (code[0] ?? '') : (code ?? '')).slice(0, CODE_LENGTH)
    return (
        <PageTransition>
            <div className={styles.page}>
                <TopAppBar
                    title="Link a Display"
                    centered
                    leading={
                        <IconButton
                            label="Kitchen displays"
                            icon={<Icon name="arrow_back" />}
                            render={<Link href="/settings/displays" />}
                            nativeButton={false}
                        />
                    }
                />
                <LinkForm
                    initialCode={initialCode}
                    taken={taken}
                    address={`${new URL(origin).host}/display`}
                    icons={{
                        display: <Icon name="smart_display" />,
                        done: <Icon name="check" />,
                        send: <Icon name="send" />,
                        error: <Icon name="error" />,
                    }}
                />
            </div>
        </PageTransition>
    )
}
