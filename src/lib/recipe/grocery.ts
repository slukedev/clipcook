// Grocery list merging and categorizing. Client-safe (js-quantities is pure JS).

import Qty from 'js-quantities'
import type { GroceryCategory, GroceryItem } from '@/lib/domain/types'
import { formatQuantity, parseIngredient, unitDef } from './ingredients'
import { cleanText, isHeadingLine } from './text'

export const MAX_GROCERY_ITEMS = 500

// Only units js-quantities understands the way a cook means them ('pinch' parses as a length).
const QTY_UNITS: Record<string, string> = {
    tsp: 'tsp',
    tbsp: 'tbsp',
    cup: 'cup',
    floz: 'floz',
    oz: 'oz',
    lb: 'lb',
    g: 'g',
    kg: 'kg',
    mg: 'mg',
    ml: 'ml',
    cl: 'cl',
    dl: 'dl',
    l: 'l',
    pint: 'pint',
    quart: 'quart',
    gallon: 'gallon',
}

const SHORT_UNIT_LABELS: Record<string, string> = {
    tsp: 'tsp',
    tbsp: 'tbsp',
    floz: 'fl oz',
    oz: 'oz',
    lb: 'lb',
    g: 'g',
    kg: 'kg',
    mg: 'mg',
    ml: 'ml',
    cl: 'cl',
    dl: 'dl',
    l: 'l',
}

const DESCRIPTORS = new Set([
    'fresh',
    'freshly',
    'chopped',
    'minced',
    'diced',
    'sliced',
    'thinly',
    'thickly',
    'finely',
    'roughly',
    'coarsely',
    'large',
    'medium',
    'small',
    'peeled',
    'softened',
    'melted',
    'cold',
    'warm',
    'packed',
    'divided',
    'grated',
    'shredded',
    'crushed',
    'cubed',
    'trimmed',
    'rinsed',
    'drained',
    'halved',
    'quartered',
    'beaten',
    'lightly',
    'about',
    'heaping',
    'level',
    'organic',
    'optional',
])

const SINGULAR_EXCEPTIONS = new Set(['molasses', 'asparagus', 'hummus', 'couscous', 'swiss', 'grits', 'oats', 'brussels', 'chips', 'greens', 'peas', 'lentils', 'noodles', 'oats', 'sprinkles'])

function singularize(word: string): string {
    if (word.length < 4 || SINGULAR_EXCEPTIONS.has(word) || /(ss|us|is)$/.test(word)) return word
    if (word.endsWith('ies')) return `${word.slice(0, -3)}y`
    if (word.endsWith('ves') && !word.endsWith('olives')) return `${word.slice(0, -3)}f`
    if (/(oes|ches|shes|xes)$/.test(word)) return word.slice(0, -2)
    if (word.endsWith('s')) return word.slice(0, -1)
    return word
}

/** 'Large Eggs, beaten' → 'egg'; used only as a merge key. */
export function normalizeGroceryName(name: string): string {
    const words = name
        .toLowerCase()
        .replace(/\([^)]*\)/g, ' ')
        .replace(/,.*$/, '')
        .replace(/[^a-z0-9\s'-]/g, ' ')
        .split(/\s+/)
        .filter((w) => w && !DESCRIPTORS.has(w) && w !== 'of' && w !== 'to' && w !== 'taste')
    if (words.length === 0) return name.trim().toLowerCase()
    const last = words.length - 1
    words[last] = singularize(words[last] as string)
    return words.join(' ')
}

const CATEGORY_RULES: Array<[RegExp, GroceryCategory]> = [
    [/\bfrozen\b|\bice cream\b/, 'frozen'],
    [/\b(peanut|almond|cashew) butter\b|\bcoconut milk\b|\bstock\b|\bbroth\b|\bbouillon\b/, 'pantry'],
    [/\b(bell|jalape[nñ]o|poblano|serrano|chili|chile|habanero|banana) peppers?\b/, 'produce'],
    [
        /\b(salt|pepper(corns?)?|paprika|cumin|cinnamon|nutmeg|oregano|thyme dried|dried \w+|chili powder|chilli flakes|red pepper flakes|turmeric|coriander seeds?|cardamom|cloves? ground|ground \w+|allspice|cayenne|curry powder|garam masala|bay leaf|bay leaves|vanilla|saffron|star anise|fennel seeds?|mustard seeds?|seasoning|spice)\b/,
        'spices',
    ],
    [
        /\b(chicken|beef|pork|lamb|turkey|bacon|sausage|ham|prosciutto|pancetta|chorizo|steak|mince|veal|duck|salmon|tuna|cod|shrimp|prawns?|scallops?|mussels|clams|crab|lobster|fish|anchov(y|ies)|halibut|tilapia|trout|sardines?)\b/,
        'meat-seafood',
    ],
    [
        /\b(milk|butter|cream|cheese|parmesan|mozzarella|cheddar|ricotta|feta|yogurt|yoghurt|eggs?|egg yolks?|egg whites?|buttermilk|sour cream|cr[eè]me fra[iî]che|mascarpone|ghee)\b/,
        'dairy-eggs',
    ],
    [/\b(bread|baguette|buns?|rolls?|tortillas?|pita|naan|brioche|croissants?|bagels?|sourdough)\b/, 'bakery'],
    [
        /\b(water|wine|beer|juice|soda|coffee|tea|espresso|vodka|rum|whiskey|whisky|bourbon|gin|tequila|brandy|cognac|sake|kombucha|sparkling)\b/,
        'drinks',
    ],
    [
        /\b(onions?|garlic|shallots?|scallions?|leeks?|tomato(es)?|potato(es)?|carrots?|celery|lettuce|spinach|kale|arugula|cabbage|broccoli|cauliflower|zucchini|squash|pumpkin|cucumbers?|eggplant|aubergine|mushrooms?|corn|peas|beans? sprouts|green beans|asparagus|avocados?|lemons?|limes?|oranges?|apples?|pears?|bananas?|berr(y|ies)|strawberr(y|ies)|blueberr(y|ies)|raspberr(y|ies)|grapes?|mangos?|mangoes|pineapple|peach(es)?|plums?|cherr(y|ies)|herbs?|basil|parsley|cilantro|coriander|mint|dill|rosemary|thyme|sage|chives|ginger|radish(es)?|beets?|sweet potato(es)?|fennel|jalape[nñ]os?|chilies|chiles)\b/,
        'produce',
    ],
    [
        /\b(flour|sugar|rice|pasta|spaghetti|noodles|oats|oil|vinegar|honey|syrup|maple|soy sauce|fish sauce|sauce|ketchup|mustard|mayonnaise|mayo|beans|lentils|chickpeas|quinoa|couscous|breadcrumbs|panko|cornstarch|baking powder|baking soda|yeast|cocoa|chocolate|nuts?|almonds?|walnuts?|pecans?|cashews?|peanuts?|raisins|seeds?|canned|tomato paste|paste|jam|cereal|crackers|gelatin|extract|tahini|miso|capers|olives)\b/,
        'pantry',
    ],
]

export function categorizeIngredient(name: string): GroceryCategory {
    const text = name.toLowerCase()
    for (const [re, category] of CATEGORY_RULES) if (re.test(text)) return category
    return 'other'
}

function unitLabel(unit: string, amount: number): string {
    const short = SHORT_UNIT_LABELS[unit]
    if (short) return short
    const def = unitDef(unit)
    if (!def) return unit
    return amount > 1 ? def.plural : def.singular
}

export function groceryText(quantity: number | null, unit: string | null, name: string): string {
    if (quantity === null) return name
    const parts = [formatQuantity(quantity, unit)]
    if (unit) parts.push(unitLabel(unit, quantity))
    parts.push(name)
    return parts.join(' ')
}

/** Adds `toAdd` to `amountOf` when the units allow it, returning the new amount in `amountOf`'s unit. */
function combine(
    existing: { quantity: number | null; unit: string | null },
    incoming: { quantity: number | null; unit: string | null },
): { quantity: number | null; unit: string | null } | null {
    if (existing.quantity === null && incoming.quantity === null && existing.unit === incoming.unit) return existing
    if (existing.quantity === null || incoming.quantity === null) return null
    if (existing.unit === incoming.unit) return { quantity: existing.quantity + incoming.quantity, unit: existing.unit }
    const a = existing.unit ? QTY_UNITS[existing.unit] : undefined
    const b = incoming.unit ? QTY_UNITS[incoming.unit] : undefined
    if (!a || !b) return null
    try {
        const qa = Qty(existing.quantity, a)
        const qb = Qty(incoming.quantity, b)
        if (!qa.isCompatible(qb)) return null
        const sum = qa.add(qb).to(a).scalar
        return { quantity: Math.round(sum * 1000) / 1000, unit: existing.unit }
    } catch {
        return null
    }
}

export interface AddLinesOptions {
    recipeId?: string
    now: number
    newId: () => string
}

/** Turns one ingredient line into a fresh grocery item, or null for headings and blanks. */
export function lineToGroceryItem(line: string, opts: AddLinesOptions): GroceryItem | null {
    const clean = cleanText(line)
    if (!clean || isHeadingLine(clean)) return null
    const parsed = parseIngredient(clean)
    const displayName = parsed.name || clean
    const name = normalizeGroceryName(displayName)
    return {
        id: opts.newId(),
        text: parsed.quantity !== null ? groceryText(parsed.quantity, parsed.unit, displayName) : clean,
        name,
        quantity: parsed.quantity,
        unit: parsed.unit,
        category: categorizeIngredient(name),
        checked: false,
        recipeIds: opts.recipeId ? [opts.recipeId] : [],
        addedAt: opts.now,
    }
}

/**
 * Merges ingredient lines into a list: same normalized name plus compatible units
 * sum up ('1 cup milk' + '4 tbsp milk' = '1¼ cups milk'); checked items are left
 * alone so a new trip starts a new line. Returns the new array (input untouched).
 */
export function addGroceryLines(items: readonly GroceryItem[], lines: readonly string[], opts: AddLinesOptions): GroceryItem[] {
    const out = items.map((item) => ({ ...item, recipeIds: [...item.recipeIds] }))
    for (const line of lines) {
        const incoming = lineToGroceryItem(line, opts)
        if (!incoming) continue
        let merged = false
        for (const item of out) {
            if (item.checked || item.name !== incoming.name) continue
            const sum = combine(item, incoming)
            if (!sum) continue
            if (sum !== item) {
                item.quantity = sum.quantity
                item.unit = sum.unit
                const display = parseIngredient(item.text).name || incoming.name
                item.text = groceryText(sum.quantity, sum.unit, display)
            }
            for (const id of incoming.recipeIds) if (!item.recipeIds.includes(id)) item.recipeIds.push(id)
            merged = true
            break
        }
        if (!merged) {
            if (out.length >= MAX_GROCERY_ITEMS) break
            out.push(incoming)
        }
    }
    return out
}

export const GROCERY_CATEGORY_ORDER: GroceryCategory[] = [
    'produce',
    'meat-seafood',
    'dairy-eggs',
    'bakery',
    'pantry',
    'spices',
    'frozen',
    'drinks',
    'other',
]

/** Groups items by category in aisle order; unchecked first within each group. */
export function groupGroceries(items: readonly GroceryItem[]): Array<{ category: GroceryCategory; items: GroceryItem[] }> {
    const groups = new Map<GroceryCategory, GroceryItem[]>()
    for (const item of items) {
        const list = groups.get(item.category) ?? []
        list.push(item)
        groups.set(item.category, list)
    }
    return GROCERY_CATEGORY_ORDER.filter((c) => groups.has(c)).map((category) => ({
        category,
        items: (groups.get(category) ?? []).toSorted((a, b) => Number(a.checked) - Number(b.checked) || a.addedAt - b.addedAt),
    }))
}
