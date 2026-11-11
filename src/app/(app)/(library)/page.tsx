import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { Icon } from '@/components/ui/icon'
import { leadEntry } from '@/lib/plan/entries'
import { queryTokens } from '@/lib/recipe/search'
import { requireSession } from '@/server/auth'
import { getStore } from '@/server/db'
import { getPlanClock } from '@/server/plan-clock'
import { getPlanEntries, listCollections, listRecipeCards, listTags } from '@/server/queries'
import { searchRecipeIds } from '@/server/search'
import { libraryIcons } from '../_library/icons'
import { Library } from '../_library/library'
import { LIBRARY_COOKIE, parseLibraryPrefs } from '../_library/library-data'
import { Tonight } from '../_library/tonight'

export const metadata: Metadata = { title: 'Library' }

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
    const [{ uid }, params, store] = await Promise.all([requireSession(), searchParams, getStore()])
    // A shared or reloaded search link renders with its ingredient matches already in place.
    const q = typeof params.q === 'string' ? params.q.slice(0, 200) : ''
    const searchKey = queryTokens(q).slice(0, 8).join(' ')
    const [recipes, collections, tags, jar, deepIds, plan, clock] = await Promise.all([
        listRecipeCards(uid),
        listCollections(uid),
        listTags(uid),
        cookies(),
        searchKey ? searchRecipeIds(store, uid, searchKey.split(' ')) : [],
        getPlanEntries(uid).catch(() => []),
        getPlanClock(),
    ])
    // Tonight's planned dish, for a cook who opens the app to start dinner.
    const lead = leadEntry(
        plan.filter((e) => e.date === clock.today && e.recipeId),
        clock.hour,
    )
    const leadRecipe = lead?.recipeId ? recipes.find((r) => r.id === lead.recipeId) : undefined
    return (
        <Library
            recipes={recipes}
            collections={collections.map((c) => ({ id: c.id, name: c.name }))}
            tags={tags}
            prefs={parseLibraryPrefs(jar.get(LIBRARY_COOKIE)?.value)}
            icons={libraryIcons()}
            initialSearch={{ key: searchKey, ids: deepIds }}
            tonight={
                lead && leadRecipe ? (
                    <Tonight
                        entry={lead}
                        recipe={leadRecipe}
                        label={lead.meal === 'dinner' ? 'Tonight' : 'Today'}
                        cookIcon={<Icon name="skillet" />}
                    />
                ) : undefined
            }
        />
    )
}
