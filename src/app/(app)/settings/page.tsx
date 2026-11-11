import type { Metadata } from 'next'
import { Icon } from '@/components/ui/icon'
import { List, ListItem } from '@/components/ui/list'
import { PageTransition } from '@/components/ui/view-transition'
import { requireSession } from '@/server/auth'
import { listCollections, listDisplays, listRecipes } from '@/server/queries'
import pkg from '../../../../package.json'
import { AccountSection } from './_sections/account'
import { AppearanceSection } from './_sections/appearance'
import { ClippingSection } from './_sections/clipping'
import { DataSection } from './_sections/data'
import { requestOrigin } from './_sections/origin'
import { PlanSection } from './_sections/plan'
import styles from './_sections/sections.module.scss'

export const metadata: Metadata = { title: 'Settings' }

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

export default async function SettingsPage() {
    const { uid } = await requireSession()
    const [displays, recipes, collections, origin] = await Promise.all([
        listDisplays(uid),
        listRecipes(uid),
        listCollections(uid),
        requestOrigin(),
    ])
    const chevron = <Icon name="chevron_right" />
    const external = <Icon name="open_in_new" size={20} />

    return (
        <PageTransition>
            <div className={styles.page}>
                <h1 className={styles.title}>Settings</h1>

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
                            supporting={displays.length === 0 ? 'None linked' : displays.map((d) => d.name).join(', ')}
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
        </PageTransition>
    )
}
