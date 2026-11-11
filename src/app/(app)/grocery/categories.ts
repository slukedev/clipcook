import type { GroceryCategory, GroceryItem } from '@/lib/domain/types'
import { groupGroceries } from '@/lib/recipe/grocery'

export const CATEGORY_LABELS: Record<GroceryCategory, string> = {
    produce: 'Produce',
    'meat-seafood': 'Meat and seafood',
    'dairy-eggs': 'Dairy and eggs',
    bakery: 'Bakery',
    pantry: 'Pantry',
    spices: 'Spices',
    frozen: 'Frozen',
    drinks: 'Drinks',
    other: 'Other',
}

/** Plain text for sharing or copying: what is left to buy, by aisle. */
export function shareText(items: readonly GroceryItem[]): string {
    const groups = groupGroceries(items.filter((item) => !item.checked))
    return groups
        .map(({ category, items: list }) =>
            [CATEGORY_LABELS[category], ...list.map((item) => `- ${item.text}`)].join('\n'),
        )
        .join('\n\n')
}
