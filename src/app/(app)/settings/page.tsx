import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Icon } from '@/components/ui/icon'
import { List, ListItem } from '@/components/ui/list'
import { Skeleton } from '@/components/ui/skeleton'
import { TopAppBar } from '@/components/ui/top-app-bar'
import { PageTransition } from '@/components/ui/view-transition'
import { requireSession } from '@/server/auth'
import { listCollections, listDisplays, listRecipes } from '@/server/queries'
import { showsUpdates, updatesView } from '@/server/updater'
import pkg from '../../../../package.json'
import { AccountSection } from './_sections/account'
import { AppearanceSection } from './_sections/appearance'
import { ClippingSection } from './_sections/clipping'
import { DataSection } from './_sections/data'
import { requestOrigin } from './_sections/origin'
import { PlanSection } from './_sections/plan'
import styles from './_sections/sections.module.scss'
import { UpdatesSection } from './_sections/updates'

export const metadata: Metadata = { title: 'Settings' }

// Installing an update copies files to GitHub from a server action on this page.
export const maxDuration = 300

const SOURCE_URL = 'https://github.com/slukedev/clipcook'
const LICENSE_URL = 'https://www.gnu.org/licenses/gpl-3.0.html'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
    return (
        <section className={styles.section} aria-labelledby={`${id}-title`} id={id}>
            <h2 id={`${id}-title`} className={styles.sectionTitle}>
                {title}
            </h2>
            {children}
        </section>
    )
}

/** Asks GitHub, so it streams in after the rest of the page. */
async function Updates({ uid }: { uid: string }) {
    const view = await updatesView(uid)
    if (!view) return null
    return (
        <UpdatesSection
            view={view}
            icons={{
                current: <Icon name="check_circle" />,
                available: <Icon name="deployed_code_update" />,
                error: <Icon name="error" />,
                auto: <Icon name="autorenew" />,
                token: <Icon name="key" />,
                repo: <Icon name="code" />,
                external: <Icon name="open_in_new" size={20} />,
                copy: <Icon name="content_copy" />,
                check: <Icon name="check" />,
            }}
        />
    )
}

export default async function SettingsPage() {
    const { uid } = await requireSession()
    const [displays, recipes, collections, origin, updates] = await Promise.all([
        listDisplays(uid),
        listRecipes(uid),
        listCollections(uid),
        requestOrigin(),
        showsUpdates(uid),
    ])
    const chevron = <Icon name="chevron_right" />
    const external = <Icon name="open_in_new" size={20} />

    return (
        <PageTransition>
            <div className={styles.screen}>
                <TopAppBar variant="medium" title="Settings" />
                <div className={styles.page}>
                    <Section id="appearance" title="Appearance">
                        <AppearanceSection
                            icons={{
                                theme: <Icon name="dark_mode" />,
                                contrast: <Icon name="contrast" />,
                                motion: <Icon name="animation" />,
                            }}
                        />
                    </Section>

                    <Section id="plan" title="Meal Plan">
                        <PlanSection />
                    </Section>

                    <Section id="displays" title="Kitchen Displays">
                        <List segmented label="Kitchen displays">
                            <ListItem
                                href="/settings/displays"
                                leading={<Icon name="cast" />}
                                headline="Displays"
                                supporting={
                                    displays.length === 0 ? 'None linked' : displays.map((d) => d.name).join(', ')
                                }
                                trailing={chevron}
                            />
                        </List>
                    </Section>

                    <Section id="clipping" title="Clipping">
                        <ClippingSection
                            origin={origin}
                            icons={{
                                bookmarklet: <Icon name="bookmark_add" />,
                                copy: <Icon name="content_copy" />,
                                check: <Icon name="check" />,
                                install: <Icon name="install_desktop" />,
                                share: <Icon name="ios_share" />,
                            }}
                        />
                    </Section>

                    <Section id="data" title="Data">
                        <DataSection
                            recipes={recipes.length}
                            collections={collections.length}
                            icons={{ export: <Icon name="download" />, import: <Icon name="upload" /> }}
                        />
                    </Section>

                    <Section id="account" title="Account">
                        <AccountSection icons={{ signOut: <Icon name="logout" /> }} />
                    </Section>

                    {updates && (
                        <Section id="updates" title="Updates">
                            <Suspense
                                fallback={
                                    <div
                                        className={styles.skeletonRows}
                                        role="status"
                                        aria-label="Checking for updates"
                                    >
                                        <Skeleton shape="large" height={72} />
                                        <Skeleton shape="large" height={72} />
                                    </div>
                                }
                            >
                                <Updates uid={uid} />
                            </Suspense>
                        </Section>
                    )}

                    <Section id="about" title="About">
                        <List segmented label="About">
                            <ListItem leading={<Icon name="info" />} headline="Version" trailingText={pkg.version} />
                            <ListItem
                                href={LICENSE_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                leading={<Icon name="description" />}
                                headline="License"
                                supporting="GPL-3.0"
                                trailing={external}
                            />
                            <ListItem
                                href={SOURCE_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                leading={<Icon name="code" />}
                                headline="Source code"
                                supporting="GitHub"
                                trailing={external}
                            />
                        </List>
                    </Section>
                </div>
            </div>
        </PageTransition>
    )
}
