import type { Metadata } from 'next'
import Link from 'next/link'
import { IconButton } from '@/components/ui/icon-button'
import { Icon } from '@/components/ui/icon'
import { TopAppBar } from '@/components/ui/top-app-bar'
import { PageTransition } from '@/components/ui/view-transition'
import { LinkForm } from './link-form'
import { CODE_LENGTH, normalizeCode } from './code'

export const metadata: Metadata = { title: 'Link a display' }

export default async function LinkPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
    const { code } = await searchParams
    const initialCode = normalizeCode(Array.isArray(code) ? (code[0] ?? '') : (code ?? '')).slice(0, CODE_LENGTH)
    return (
        <PageTransition>
            <TopAppBar
                title="Link a display"
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
                icons={{
                    display: <Icon name="smart_display" />,
                    done: <Icon name="check" />,
                    send: <Icon name="send" />,
                    error: <Icon name="error" />,
                }}
            />
        </PageTransition>
    )
}
