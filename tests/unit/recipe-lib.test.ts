import { describe, expect, it } from 'vitest'
import type { GroceryItem } from '@/lib/domain/types'
import { addGroceryLines, categorizeIngredient, normalizeGroceryName } from '@/lib/recipe/grocery'
import { formatQuantity, parseIngredient, prettifyFractions, scaleIngredient } from '@/lib/recipe/ingredients'
import { parseRecipeText } from '@/lib/recipe/text-import'
import { cleanText, decodeEntities, normalizeFractions } from '@/lib/recipe/text'
import { deriveTotalMinutes, formatMinutes, parseDurationToMinutes } from '@/lib/recipe/time'
import { findTimers } from '@/lib/recipe/timers'

describe('text cleanup', () => {
    it('decodes named, numeric, hex, and double-encoded entities but leaves bare ampersands', () => {
        expect(decodeEntities('Mac &amp; Cheese &#8211; Mom&#x2019;s &amp;#39;best&amp;#39;')).toBe(
            "Mac & Cheese – Mom’s 'best'",
        )
        expect(decodeEntities('R&D and AT&T')).toBe('R&D and AT&T')
        expect(decodeEntities('&bogus; &#0; &#xFFFFFFF;')).toBe('&bogus; &#0; &#xFFFFFFF;')
    })

    it('normalizes vulgar fractions and the fraction slash to ASCII', () => {
        expect(normalizeFractions('1½ cups, ¾ tsp, 2 ⅓ lb, 1⁄4 cup')).toBe('1 1/2 cups, 3/4 tsp, 2 1/3 lb, 1/4 cup')
    })

    it('strips tags and collapses nbsp / zero-width space', () => {
        expect(cleanText('<p>Stir&nbsp;&nbsp;well</p>​<script>alert(1)</script>  now')).toBe('Stir well now')
    })
})

describe('parseIngredient', () => {
    it('parses mixed numbers, equivalents in parentheses, and notes after a comma', () => {
        expect(parseIngredient('1 1/2 cups (190 g) flour, sifted')).toMatchObject({
            quantity: 1.5,
            quantityMax: null,
            unit: 'cup',
            name: 'flour',
            note: '190 g, sifted',
        })
    })

    it('handles unicode fractions glued to the number and hyphenated mixed numbers', () => {
        expect(parseIngredient('1½ tsp salt')).toMatchObject({ quantity: 1.5, unit: 'tsp', name: 'salt' })
        expect(parseIngredient('1-1/2 cups milk')).toMatchObject({ quantity: 1.5, unit: 'cup', name: 'milk' })
    })

    it('reads ranges with dash, en dash, and "to"', () => {
        expect(parseIngredient('2-3 cloves garlic')).toMatchObject({
            quantity: 2,
            quantityMax: 3,
            unit: 'clove',
            name: 'garlic',
        })
        expect(parseIngredient('2–3 tbsp butter')).toMatchObject({ quantity: 2, quantityMax: 3, unit: 'tbsp' })
        expect(parseIngredient('4 to 6 chicken thighs')).toMatchObject({
            quantity: 4,
            quantityMax: 6,
            unit: null,
            name: 'chicken thighs',
        })
    })

    it('treats "a pinch of" as one pinch and keeps "a few" unquantified', () => {
        expect(parseIngredient('a pinch of salt')).toMatchObject({ quantity: 1, unit: 'pinch', name: 'salt' })
        expect(parseIngredient('A few sprigs thyme')).toMatchObject({ quantity: null, name: 'A few sprigs thyme' })
    })

    it('distinguishes T (tablespoon) from t (teaspoon) and package sizes from equivalents', () => {
        expect(parseIngredient('1 T honey').unit).toBe('tbsp')
        expect(parseIngredient('1 t vanilla').unit).toBe('tsp')
        expect(parseIngredient('1 (14 oz) can diced tomatoes')).toMatchObject({
            quantity: 1,
            unit: 'can',
            name: 'diced tomatoes',
            note: '14 oz',
        })
    })

    it('does not mistake temperatures or bare words for amounts', () => {
        expect(parseIngredient('Salt and pepper to taste')).toMatchObject({
            quantity: null,
            name: 'Salt and pepper',
            note: 'to taste',
        })
        expect(parseIngredient('350°F oven').quantity).toBeNull()
        expect(parseIngredient('# For the sauce').isHeading).toBe(true)
    })
})

describe('scaleIngredient', () => {
    it('scales the amount and the trailing equivalent, prints glyphs, and pluralizes word units', () => {
        expect(scaleIngredient('1 1/2 cups (190 g) flour, sifted', 2)).toBe('3 cups (380 g) flour, sifted')
        expect(scaleIngredient('1 cup sugar', 1.5)).toBe('1½ cups sugar')
        expect(scaleIngredient('2 tablespoons butter', 0.5)).toBe('1 tablespoon butter')
    })

    it('keeps package sizes fixed', () => {
        expect(scaleIngredient('1 (14 oz) can tomatoes', 2)).toBe('2 (14 oz) cans tomatoes')
    })

    it('scales both ends of a range and word quantities', () => {
        expect(scaleIngredient('2-3 cloves garlic', 2)).toBe('4–6 cloves garlic')
        expect(scaleIngredient('a pinch of salt', 2)).toBe('2 pinches of salt')
    })

    it('leaves numbers that are not leading amounts alone', () => {
        expect(scaleIngredient('Juice of 1 lemon', 3)).toBe('Juice of 1 lemon')
        expect(scaleIngredient('Bake at 350 degrees', 2)).toBe('Bake at 350 degrees')
    })

    it('rounds metric weights instead of using fractions', () => {
        expect(scaleIngredient('250 g butter', 1 / 3)).toBe('83 g butter')
        expect(scaleIngredient('1.5 kg potatoes', 0.5)).toBe('0.75 kg potatoes')
    })

    it('returns the cleaned line at scale 1 or on bad factors', () => {
        expect(scaleIngredient('1 1/2 cups milk', 1)).toBe('1½ cups milk')
        expect(scaleIngredient('1 cup milk', Number.NaN)).toBe('1 cup milk')
    })
})

describe('formatQuantity', () => {
    it.each([
        [0.5, '½'],
        [1 / 3, '⅓'],
        [2.25, '2¼'],
        [0.666, '⅔'],
        [1.99, '2'],
        [1.43, '1.43'],
        [0.125, '⅛'],
        [24.4, '24'],
    ])('%s → %s', (n, expected) => {
        expect(formatQuantity(n)).toBe(expected)
    })

    it('prettifies ASCII fractions inside text without touching dates or ratios', () => {
        expect(prettifyFractions('1 1/2 cups, 3/4 tsp')).toBe('1½ cups, ¾ tsp')
        expect(prettifyFractions('12/25/2024 and 7/16 inch')).toBe('12/25/2024 and 7/16 inch')
    })
})

describe('time', () => {
    it.each([
        ['PT1H30M', 90],
        ['P0DT0H45M', 45],
        ['PT90M', 90],
        ['PT0.5H', 30],
        ['P1D', 1440],
        ['1 hr 15 min', 75],
        ['1 hour and 30 minutes', 90],
        ['1 1/2 hours', 90],
        ['1½ hrs', 90],
        ['an hour and a half', 90],
        ['10-15 mins', 10],
        ['1:30', 90],
        ['45', 45],
        ['half an hour', 30],
    ])('%s → %s minutes', (input, minutes) => {
        expect(parseDurationToMinutes(input)).toBe(minutes)
    })

    it('rejects garbage', () => {
        expect(parseDurationToMinutes('P')).toBeNull()
        expect(parseDurationToMinutes('overnight')).toBeNull()
        expect(parseDurationToMinutes('')).toBeNull()
    })

    it('formats minutes', () => {
        expect(formatMinutes(75)).toBe('1 hr 15 min')
        expect(formatMinutes(45)).toBe('45 min')
        expect(formatMinutes(120)).toBe('2 hr')
        expect(formatMinutes(1500)).toBe('1 day 1 hr')
        expect(formatMinutes(0)).toBe('')
    })

    it('derives total from prep plus cook when total is missing', () => {
        expect(deriveTotalMinutes({ prepTime: '15 min', cookTime: '1 hr' })).toBe(75)
        expect(deriveTotalMinutes({ totalTime: 'PT2H', prepTime: '15 min' })).toBe(120)
        expect(deriveTotalMinutes({})).toBeNull()
    })
})

describe('findTimers', () => {
    it('finds ranges, compounds, words, and fractions with offsets', () => {
        const text = 'Simmer 10 to 12 minutes, then rest 1 hour 30 min. Toast 45 sec.'
        const timers = findTimers(text)
        expect(timers.map((t) => [t.label, t.seconds, t.maxSeconds])).toEqual([
            ['10 to 12 minutes', 600, 720],
            ['1 hour 30 min', 5400, 5400],
            ['45 sec', 45, 45],
        ])
        for (const t of timers) expect(text.slice(t.start, t.end)).toBe(t.label)
    })

    it('reads "an hour and a half", "half an hour", and "1½ hours"', () => {
        expect(findTimers('Bake for an hour and a half.')[0]?.seconds).toBe(5400)
        expect(findTimers('Chill half an hour.')[0]?.seconds).toBe(1800)
        expect(findTimers('Braise 1½ hours.')[0]?.seconds).toBe(5400)
    })

    it('ignores temperatures, sizes, and quantities that are not durations', () => {
        expect(findTimers('Heat oven to 350°F. Use a 9x13 pan and 2 medium onions. Add 3 eggs.')).toEqual([])
        expect(findTimers('Cut into 2 m pieces')).toEqual([])
    })

    it('accepts compact forms like 5m and 30s only after a digit', () => {
        expect(findTimers('Rest 5m then sear 30s').map((t) => t.seconds)).toEqual([300, 30])
    })
})

describe('parseRecipeText', () => {
    it('splits a typical pasted recipe into sections with metadata', () => {
        const r = parseRecipeText(`Grandma's Brownies

The fudgy kind.
Serves 12 | Prep: 15 mins | Cook: 30 minutes

Ingredients:
- 1 cup butter
- 2 cups sugar
For the topping:
• ½ cup walnuts

Directions
1. Melt the butter.
2. Stir in sugar
   until glossy.
3. Bake 30 minutes.

Notes
Keeps for 3 days.`)
        expect(r.title).toBe("Grandma's Brownies")
        expect(r.description).toBe('The fudgy kind.')
        expect(r.servings).toBe('12')
        expect(r.prepTime).toBe('15 min')
        expect(r.cookTime).toBe('30 min')
        expect(r.ingredients).toEqual(['1 cup butter', '2 cups sugar', '# For the topping', '1/2 cup walnuts'])
        expect(r.instructions).toEqual(['Melt the butter.', 'Stir in sugar until glossy.', 'Bake 30 minutes.'])
        expect(r.notes).toBe('Keeps for 3 days.')
    })

    it('handles headerless text by line shape and picks up a source URL', () => {
        const r = parseRecipeText(`https://example.com/salad
Quick Salad
2 tomatoes
1 cucumber
Chop everything into bite size pieces and toss with olive oil and salt before serving.`)
        expect(r.sourceUrl).toBe('https://example.com/salad')
        expect(r.title).toBe('Quick Salad')
        expect(r.ingredients).toEqual(['2 tomatoes', '1 cucumber'])
        expect(r.instructions).toHaveLength(1)
    })

    it('splits inline numbered steps and markdown headings', () => {
        const r = parseRecipeText(`# Toast
## Ingredients
* bread
## Method
1. Toast it. 2. Butter it.`)
        expect(r.title).toBe('Toast')
        expect(r.ingredients).toEqual(['bread'])
        expect(r.instructions).toEqual(['Toast it.', 'Butter it.'])
    })

    it('returns an empty-ish result for blank input', () => {
        expect(parseRecipeText('   \n\n')).toEqual({})
    })
})

describe('grocery', () => {
    let n = 0
    const opts = { now: 1, newId: () => `g${++n}` }

    it('normalizes names for merging', () => {
        expect(normalizeGroceryName('Large Eggs, beaten')).toBe('egg')
        expect(normalizeGroceryName('fresh tomatoes (ripe)')).toBe('tomato')
        expect(normalizeGroceryName('Molasses')).toBe('molasses')
    })

    it('merges compatible units and sums same-unit amounts', () => {
        const items = addGroceryLines(
            [],
            ['1 cup milk', '4 tbsp milk', '2 eggs', '1 large egg', 'salt to taste', 'Salt'],
            {
                ...opts,
                recipeId: 'r1',
            },
        )
        const milk = items.find((i) => i.name === 'milk')
        expect(milk?.quantity).toBeCloseTo(1.25)
        expect(milk?.text).toBe('1¼ cups milk')
        const eggs = items.find((i) => i.name === 'egg')
        expect(eggs?.quantity).toBe(3)
        expect(items.filter((i) => i.name === 'salt')).toHaveLength(1)
        expect(items).toHaveLength(3)
    })

    it('does not merge incompatible units or into checked items', () => {
        const base: GroceryItem[] = addGroceryLines([], ['200 g flour'], opts).map((i) => ({ ...i, checked: true }))
        const out = addGroceryLines(base, ['1 cup flour', '100 g flour', '1 pinch flour'], opts)
        expect(out.map((i) => i.text)).toEqual(['200 g flour', '1 cup flour', '100 g flour', '1 pinch flour'])
        expect(out[0]?.quantity).toBe(200)
        expect(base[0]?.quantity).toBe(200)
    })

    it('categorizes tricky names', () => {
        expect(categorizeIngredient('peanut butter')).toBe('pantry')
        expect(categorizeIngredient('red bell pepper')).toBe('produce')
        expect(categorizeIngredient('black pepper')).toBe('spices')
        expect(categorizeIngredient('frozen peas')).toBe('frozen')
        expect(categorizeIngredient('chicken thigh')).toBe('meat-seafood')
        expect(categorizeIngredient('egg')).toBe('dairy-eggs')
        expect(categorizeIngredient('chicken stock')).toBe('pantry')
        expect(categorizeIngredient('mystery')).toBe('other')
    })

    it('caps the list size', () => {
        const lines = Array.from({ length: 600 }, (_, i) => `item${i}`)
        expect(addGroceryLines([], lines, opts)).toHaveLength(500)
    })
})
