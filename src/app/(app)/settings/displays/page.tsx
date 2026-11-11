import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { Icon } from '@/components/ui/icon'
import { IconButton } from '@/components/ui/icon-button'
import { TopAppBar } from '@/components/ui/top-app-bar'
import { PageTransition } from '@/components/ui/view-transition'
import { requireSession } from '@/server/auth'
import { listDisplays, listRecipes } from '@/server/queries'
import { AddDisplaySteps } from './add-display'
import { DisplaysList } from './displays-list'
import styles from './displays.module.scss'

export const metadata: Metadata = { title: 'Kitchen displays' }

/** The host people type on the display: the public origin without its scheme. */
async function publicHost(): Promise<string> {
    const configured = process.env.APP_URL?.trim()
    if (configured) {
        try {
            return new URL(configured).host
        } catch {
            // fall through to the request
        }
    }
    const list = await headers()
    return list.get('x-forwarded-host')?.split(',')[0]?.trim() || list.get('host') || 'localhost'
}

export default async function DisplaysPage() {
    const user = await requireSession()
    const [displays, recipes, host] = await Promise.all([listDisplays(user.uid), listRecipes(user.uid), publicHost()])
    const showing = new Set(displays.flatMap((d) => (d.current ? [d.current.recipeId] : [])))
    const recipeTitles: Record<string, string> = {}
    for (const recipe of recipes) if (showing.has(recipe.id)) recipeTitles[recipe.id] = recipe.title
    const castEnabled = Boolean(process.env.NEXT_PUBLIC_CAST_APP_ID)

    const steps = (
        <AddDisplaySteps
            host={host}
            castEnabled={castEnabled}
            icons={{
                link: <Icon name="qr_code_2" />,
                echo: <Icon name="smart_display" />,
                nest: <Icon name="cast" />,
                tablet: <Icon name="tablet" />,
            }}
        />
    )

    return (
        <PageTransition>
            <TopAppBar
                variant="medium"
                title="Kitchen displays"
                leading={
                    <IconButton
                        label="Settings"
                        icon={<Icon name="arrow_back" />}
                        render={<Link href="/settings" />}
                        nativeButton={false}
                    />
                }
            />
            <div className={styles.body}>
                <DisplaysList
                    displays={displays}
                    recipeTitles={recipeTitles}
                    now={Date.now()}
                    steps={steps}
                    icons={{
                        display: <Icon name="smart_display" />,
                        add: <Icon name="add" />,
                        more: <Icon name="more_vert" />,
                        edit: <Icon name="edit" />,
                        clear: <Icon name="cancel" />,
                        remove: <Icon name="delete" />,
                    }}
                />
                <aside className={styles.sidePane} aria-labelledby="add-display-title">
                    <h2 id="add-display-title" className={styles.sideTitle}>
                        Add a display
                    </h2>
                    {steps}
                </aside>
            </div>
        </PageTransition>
    )
}
