import type { GroceryCategory, GroceryItem } from '@/lib/domain/types'

export const CATEGORY_LABELS: Record<GroceryCategory, string> = {
    produce: 'Produce',
    'meat-seafood': 'Meat and Seafood',
    'dairy-eggs': 'Dairy and Eggs',
    bakery: 'Bakery',
    pantry: 'Pantry',
    spices: 'Spices',
    frozen: 'Frozen',
    drinks: 'Drinks',
    other: 'Other',
}

/**
 * The order most stores are walked in: fresh food at the entrance, shelves in the
 * middle, and frozen last so it is the shortest time out of the freezer.
 */
export const AISLE_ORDER: readonly GroceryCategory[] = [
    'produce',
    'bakery',
    'meat-seafood',
    'dairy-eggs',
    'pantry',
    'spices',
    'drinks',
    'other',
    'frozen',
]

export interface Aisle {
    category: GroceryCategory
    items: GroceryItem[]
}

/** Groups by aisle in walking order. Rows keep the order they were added in, checked or not. */
export function groupByAisle(items: readonly GroceryItem[]): Aisle[] {
    const groups = new Map<GroceryCategory, GroceryItem[]>()
    for (const item of items) {
        const list = groups.get(item.category) ?? []
        list.push(item)
        groups.set(item.category, list)
    }
    return AISLE_ORDER.filter((category) => groups.has(category)).map((category) => ({
        category,
        items: (groups.get(category) ?? []).toSorted((a, b) => a.addedAt - b.addedAt),
    }))
}

/** Plain text for sharing or copying: what is left to buy, by aisle. */
export function shareText(items: readonly GroceryItem[]): string {
    const groups = groupByAisle(items.filter((item) => !item.checked))
    return groups
        .map(({ category, items: list }) =>
            [CATEGORY_LABELS[category], ...list.map((item) => `- ${item.text}`)].join('\n'),
        )
        .join('\n\n')
}
