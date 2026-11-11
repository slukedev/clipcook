import { Icon } from '@/components/ui/icon'
import type { RecipeSummary } from '@/lib/domain/types'
import { getDisplaySession } from '@/server/display-auth'
import { listRecipes } from '@/server/queries'
import { DisplayHome, type HomeTile } from './home'
import { Pairing } from './pairing'

const TILE_LIMIT = 12

function toTile(recipe: RecipeSummary): HomeTile {
    return { id: recipe.id, title: recipe.title, thumbnail: recipe.thumbnail, totalTime: recipe.totalTime }
}

export default async function DisplayPage() {
    const display = await getDisplaySession()
    if (!display)
        return (
            <Pairing
                icons={{
                    done: <Icon name="check" />,
                    error: <Icon name="wifi_off" />,
                    wait: <Icon name="hourglass_empty" />,
                }}
            />
        )

    const recipes = await listRecipes(display.uid)
    const favorites = recipes.filter((r) => r.favorite).slice(0, TILE_LIMIT)
    const shown = new Set(favorites.map((r) => r.id))
    const recent = recipes
        .filter((r) => !shown.has(r.id))
        .toSorted((a, b) => Math.max(b.lastCookedAt ?? 0, b.createdAt) - Math.max(a.lastCookedAt ?? 0, a.createdAt))
        .slice(0, TILE_LIMIT)

    return (
        <DisplayHome
            name={display.name}
            favorites={favorites.map(toTile)}
            recent={recent.map(toTile)}
            icons={{ recipe: <Icon name="restaurant" />, time: <Icon name="schedule" /> }}
        />
    )
}
