import type { ImportCounts } from '@/lib/domain/types'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** What the export file will hold, so people know it is everything. */
export function exportSummary(recipes: number, collections: number): string {
    if (recipes === 0 && collections === 0) return 'Recipes, collections and grocery list'
    const parts = [plural(recipes, 'recipe', 'recipes')]
    if (collections > 0) parts.push(plural(collections, 'collection', 'collections'))
    parts.push('grocery list')
    return parts.length === 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}

export function importedMessage(counts: ImportCounts): string {
    const added: string[] = []
    if (counts.recipesAdded > 0) added.push(plural(counts.recipesAdded, 'recipe', 'recipes'))
    if (counts.collectionsAdded > 0) added.push(plural(counts.collectionsAdded, 'collection', 'collections'))
    if (counts.groceryItemsAdded > 0) added.push(plural(counts.groceryItemsAdded, 'grocery item', 'grocery items'))
    if (added.length === 0)
        return counts.recipesSkipped > 0 ? 'Everything in that file is already here' : 'Nothing to import'
    const list = added.length === 1 ? added[0] : `${added.slice(0, -1).join(', ')} and ${added.at(-1)}`
    return counts.recipesSkipped > 0 ? `Added ${list}. ${counts.recipesSkipped} already here.` : `Added ${list}`
}
