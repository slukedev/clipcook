import { requireSession } from '@/server/auth'
import { listRecipesForUser } from '@/server/recipes'
import { HomeClient } from './HomeClient'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
    const session = await requireSession()
    const recipes = await listRecipesForUser(session.uid)
    return <HomeClient recipes={recipes} />
}
