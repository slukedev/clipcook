import type { Metadata } from 'next'
import { Icon } from '@/components/ui/icon'
import { PageTransition } from '@/components/ui/view-transition'
import type { GroceryCategory } from '@/lib/domain/types'
import { requireSession } from '@/server/auth'
import { getGroceryList, listRecipes } from '@/server/queries'
import { type GroceryIcons, GroceryList } from './grocery-list'

export const metadata: Metadata = { title: 'Grocery list' }

const CATEGORY_ICONS: Record<GroceryCategory, React.ReactNode> = {
    produce: <Icon name="nutrition" />,
    'meat-seafood': <Icon name="set_meal" />,
    'dairy-eggs': <Icon name="egg" />,
    bakery: <Icon name="bakery_dining" />,
    pantry: <Icon name="inventory_2" />,
    spices: <Icon name="eco" />,
    frozen: <Icon name="icecream" />,
    drinks: <Icon name="local_cafe" />,
    other: <Icon name="shopping_basket" />,
}

// Rendered here so the client bundle does not carry the icon map.
const ICONS: GroceryIcons = {
    categories: CATEGORY_ICONS,
    done: <Icon name="done_all" />,
    add: <Icon name="add" />,
    send: <Icon name="arrow_upward" />,
    share: <Icon name="share" />,
    more: <Icon name="more_vert" />,
    delete: <Icon name="delete" />,
    clearAll: <Icon name="delete_sweep" />,
    clearChecked: <Icon name="remove_shopping_cart" />,
    recipe: <Icon name="menu_book" />,
    empty: <Icon name="shopping_basket" />,
    browse: <Icon name="library_books" />,
}

export default async function GroceryPage() {
    const user = await requireSession()
    const [items, recipes] = await Promise.all([getGroceryList(user.uid), listRecipes(user.uid)])
    // Only the titles of recipes that contributed, so the client gets a small map.
    const used = new Set(items.flatMap((item) => item.recipeIds))
    const recipeTitles: Record<string, string> = {}
    for (const recipe of recipes) if (used.has(recipe.id)) recipeTitles[recipe.id] = recipe.title
    return (
        <PageTransition>
            <GroceryList items={items} recipeTitles={recipeTitles} icons={ICONS} />
        </PageTransition>
    )
}
