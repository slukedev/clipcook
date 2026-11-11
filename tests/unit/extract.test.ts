import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cleanTags, extractRecipe } from '@/server/clip/extract'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/clip/${name}`, import.meta.url), 'utf8')

describe('JSON-LD', () => {
    const recipe = extractRecipe(fixture('jsonld-graph.html'), 'https://pepperandpot.example/weeknight-chili/?utm_source=x')

    it('finds a Recipe with an @type array inside @graph, skipping other blocks', () => {
        expect(recipe?.method).toBe('jsonld')
        expect(recipe?.title).toBe('Weeknight Chili & Cornbread')
        expect(recipe?.description).toBe('A fast chili with "real" depth.')
    })

    it('decodes entities (including double-encoded), normalizes fractions, collapses space, and dedupes', () => {
        expect(recipe?.ingredients).toEqual([
            '2 tablespoons olive oil',
            '1 1/2 pounds ground beef',
            '1 (28 oz) can crushed tomatoes',
            '1 tsp ground cumin',
            'Salt & pepper, to taste',
        ])
    })

    it('keeps HowToSection names as headings and splits <br> steps', () => {
        expect(recipe?.instructions).toEqual([
            '# Chili',
            'Heat the oil in a large pot over medium-high heat.',
            'Brown the beef, 6 to 8 minutes.',
            'Drain the fat.',
            '# To serve',
            'Simmer 45 minutes, then ladle into bowls.',
        ])
    })

    it('resolves the image @id reference, ISO durations, and the yield array', () => {
        expect(recipe?.imageUrl).toBe('https://cdn.pepperandpot.example/chili-1200.jpg')
        expect(recipe?.servings).toBe('6')
        expect(recipe?.prepTime).toBe('15 min')
        expect(recipe?.cookTime).toBe('1 hr')
        expect(recipe?.totalTime).toBe('1 hr 15 min')
    })

    it('uses the canonical URL and og:site_name, and drops junk tags', () => {
        expect(recipe?.sourceUrl).toBe('https://www.pepperandpot.example/weeknight-chili/')
        expect(recipe?.sourceName).toBe('Pepper & Pot')
        expect(recipe?.tags).toEqual(['main course', 'dinner', 'american', 'chili', 'weeknight', 'beef chili', '30-minute meals'])
    })

    it('handles a top-level array, mainEntity, @type URL form, HTML instructions, and a legacy ingredients string', () => {
        const r = extractRecipe(fixture('jsonld-array.html'), 'https://sunny.example/lemon-bars')
        expect(r?.title).toBe('Lemon Bars')
        expect(r?.ingredients).toEqual(['1 cup flour', '1/2 cup butter, softened', '3/4 cup sugar'])
        expect(r?.instructions).toEqual([
            'Heat oven to 350°F.',
            'Press crust into pan; bake 20 minutes.',
            'Pour filling & bake 25 more minutes.',
        ])
        expect(r?.servings).toBe('16 bars')
        expect(r?.totalTime).toBe('1 hr 30 min')
        expect(r?.imageUrl).toBe('https://sunny.example/lemon-small.jpg')
        expect(r?.sourceName).toBe('Sunny Kitchen')
    })

    it('accepts raw JSON-LD strings from the bookmarklet with no HTML at all', () => {
        const ld = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Recipe',
            name: 'Toast',
            recipeIngredient: ['1 slice bread', 'butter'],
            recipeInstructions: 'Toast the bread.\nButter it.',
        })
        const r = extractRecipe('', 'https://www.toast.example/a', [ld, '{not json'])
        expect(r?.instructions).toEqual(['Toast the bread.', 'Butter it.'])
        expect(r?.sourceName).toBe('toast.example')
    })

    it('ignores a canonical that points at another site', () => {
        const html = fixture('jsonld-array.html').replace('<head>', '<head><link rel="canonical" href="https://evil.example/x">')
        expect(extractRecipe(html, 'https://sunny.example/lemon-bars')?.sourceUrl).toBe('https://sunny.example/lemon-bars')
    })

    it('splits one paragraph of inline-numbered steps', () => {
        const ld = JSON.stringify({
            '@type': 'Recipe',
            name: 'X',
            recipeIngredient: ['a', 'b'],
            recipeInstructions: '1. Mix the batter well. 2. Bake until golden. 3. Cool on a rack.',
        })
        expect(extractRecipe('', 'https://x.example/', [ld])?.instructions).toEqual([
            'Mix the batter well.',
            'Bake until golden.',
            'Cool on a rack.',
        ])
    })
})

describe('microdata', () => {
    const r = extractRecipe(fixture('microdata.html'), 'https://flip.example/pancakes')

    it('reads schema.org/Recipe item properties without leaking nested items', () => {
        expect(r?.method).toBe('microdata')
        expect(r?.title).toBe('Fluffy Pancakes')
        expect(r?.ingredients).toEqual(['1 1/2 cups flour', '2 tbsp sugar', '1 1/4 cups milk'])
        expect(r?.instructions).toEqual([
            'Whisk the dry ingredients.',
            'Add milk and stir until just combined.',
            'Cook on a hot griddle, 2 minutes per side.',
        ])
        expect(r?.servings).toBe('8 pancakes')
        expect(r?.prepTime).toBe('10 min')
        expect(r?.cookTime).toBe('15 min')
        expect(r?.imageUrl).toBe('https://flip.example/photos/pancakes.jpg')
        expect(r?.sourceName).toBe('Flip Daily')
        expect(r?.tags).toEqual(['breakfast'])
    })
})

describe('plugin cards', () => {
    it('reads WP Recipe Maker groups, notes, lazy images, and split times', () => {
        const r = extractRecipe(fixture('wprm.html'), 'https://woknight.example/garlic-noodles/')
        expect(r?.method).toBe('wprm')
        expect(r?.title).toBe('Garlic Noodles')
        expect(r?.ingredients).toEqual([
            '# Noodles',
            '8 oz lo mein noodles',
            '# Sauce',
            '1/3 cup butter, unsalted',
            '10 cloves garlic, minced',
            '2 tbsp oyster sauce',
        ])
        expect(r?.instructions).toEqual([
            'Cook the noodles per the package.',
            'Melt butter, add garlic, cook 2 minutes.',
            'Toss everything together.',
        ])
        expect(r?.prepTime).toBe('5 min')
        expect(r?.cookTime).toBe('1 hr 10 min')
        expect(r?.servings).toBe('4')
        expect(r?.notes).toBe('Use fresh noodles if you can.')
        expect(r?.imageUrl).toBe('https://woknight.example/wp-content/uploads/noodles-1024x1024.jpg')
        expect(r?.tags).toEqual(['main course', 'chinese', 'asian', 'noodles', 'garlic'])
    })

    it('prefers WPRM grouped ingredients over the same flat JSON-LD list', () => {
        const ld = `<script type="application/ld+json">${JSON.stringify({
            '@type': 'Recipe',
            name: 'Garlic Noodles (JSON)',
            recipeIngredient: ['8 oz lo mein noodles', '1/3 cup butter', '10 cloves garlic', '2 tbsp oyster sauce'],
            recipeInstructions: [{ '@type': 'HowToStep', text: 'Do it all.' }],
        })}</script>`
        const html = fixture('wprm.html').replace('</head>', `${ld}</head>`)
        const r = extractRecipe(html, 'https://woknight.example/garlic-noodles/')
        expect(r?.method).toBe('jsonld')
        expect(r?.title).toBe('Garlic Noodles (JSON)')
        expect(r?.ingredients?.[0]).toBe('# Noodles')
        expect(r?.instructions).toEqual(['Do it all.'])
        expect(r?.notes).toBe('Use fresh noodles if you can.')
    })

    it('reads Tasty Recipes with bold paragraph group names', () => {
        const r = extractRecipe(fixture('tasty.html'), 'https://bake.example/banana-bread')
        expect(r?.method).toBe('tasty')
        expect(r?.ingredients).toEqual([
            '# Wet',
            '3 ripe bananas',
            '1/3 cup melted butter',
            '# Dry',
            '1 1/2 cups flour',
            '1 tsp baking soda',
        ])
        expect(r?.instructions).toEqual(['Mash bananas.', 'Mix in the rest.', 'Bake 60 minutes at 350°F.'])
        expect(r?.servings).toBe('1 loaf')
        expect(r?.cookTime).toBe('1 hr')
        expect(r?.notes).toBe('Freezes well.')
        expect(r?.tags).toEqual(['bread'])
    })

    it('reads Mediavine Create cards', () => {
        const r = extractRecipe(fixture('mvcreate.html'), 'https://salsa.example/')
        expect(r?.method).toBe('mvcreate')
        expect(r?.ingredients).toEqual(['4 tomatoes, diced', '1 jalapeño, minced', 'Juice of 1 lime'])
        expect(r?.servings).toBe('4 to 6')
        expect(r?.prepTime).toBe('15 min')
    })
})

describe('heuristic fallback', () => {
    it('reads lists after Ingredients/Directions headings and stops at the next section', () => {
        const r = extractRecipe(fixture('heuristic.html'), 'https://soup.example/grandma')
        expect(r?.method).toBe('heuristic')
        expect(r?.title).toBe("Grandma's Chicken Soup")
        expect(r?.ingredients).toEqual([
            '1 whole chicken',
            '3 carrots, sliced',
            '2 celery stalks',
            '# For the noodles',
            '2 cups egg noodles',
        ])
        expect(r?.instructions).toEqual(['Put the chicken in a pot and cover with water.', 'Simmer 2 hours.'])
        expect(r?.imageUrl).toBe('https://soup.example/og.jpg')
        expect(r?.description).toBe('The one we make every winter.')
    })

    it('returns null for a page with no recipe', () => {
        expect(extractRecipe('<h1>About us</h1><ul><li>Team</li></ul>', 'https://x.example/')).toBeNull()
    })
})

describe('cleanTags', () => {
    it('lowercases, dedupes, drops junk and the site name, caps at 8', () => {
        expect(
            cleanTags(['Dinner', 'dinner ', 'Recipe', 'SiteName', '12345', 'https://x.com', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], [
                'sitename',
            ]),
        ).toEqual(['dinner', 'a', 'b', 'c', 'd', 'e', 'f', 'g'])
    })
})
