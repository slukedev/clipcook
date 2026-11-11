import { readFileSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test, unique } from './support/fixtures'
import { exportLibrary } from './support/library'

const fixture = (name: string) => readFileSync(path.resolve(__dirname, '../fixtures/clip', name), 'utf8')

function recipeText(title: string): string {
    return [
        title,
        '',
        'A weeknight braise that tastes like it took all day.',
        '',
        'Serves 4',
        'Prep: 15 min | Cook: 45 min',
        '',
        'Ingredients',
        '2 tablespoons olive oil',
        '1 large onion, sliced',
        '3 cloves garlic, minced',
        '1 can (14 oz) crushed tomatoes',
        '2 cups cooked white beans',
        '1 teaspoon smoked paprika',
        '',
        'Instructions',
        '1. Warm the oil in a heavy pot and cook the onion until soft, about 8 minutes.',
        '2. Stir in the garlic and paprika and cook for 1 minute.',
        '3. Add the tomatoes and beans, then simmer for 30 minutes until thick.',
    ].join('\n')
}

/** The review screen shows what was found before anything is saved. */
async function expectReview(page: Page, title: string, ingredient: string, step: string) {
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    const ingredients = page.getByRole('region', { name: 'Ingredients' })
    await expect(ingredients.getByRole('listitem').filter({ hasText: ingredient })).toHaveCount(1)
    const steps = page.getByRole('region', { name: 'Steps' })
    await expect(steps.getByRole('listitem').filter({ hasText: step })).toHaveCount(1)
}

/**
 * Saves the reviewed clip and checks the recipe page that opens shows the same recipe.
 * A title already in the library is flagged, and saving it makes a copy.
 */
async function saveAndExpectRecipe(page: Page, title: string, ingredient: string, step: string) {
    const known = (await exportLibrary(page)).recipes.some((r) => r.title === title)
    await expect(page.getByRole('status').filter({ hasText: 'Already in your library' })).toHaveCount(known ? 1 : 0)
    await page.getByRole('button', { name: known ? 'Save copy' : 'Save', exact: true }).click()
    await expect(page).toHaveURL(/\/recipe\/[\w-]+$/)
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(
        page.getByRole('region', { name: 'Ingredients' }).getByRole('checkbox', { name: ingredient }),
    ).toBeVisible()
    await expect(
        page.getByRole('region', { name: 'Steps' }).getByRole('listitem').filter({ hasText: step }),
    ).toHaveCount(1)
}

test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('a shared-text deep link survives sign-in and clips the text', async ({ page }, testInfo) => {
        const title = unique(testInfo, 'Shared Lentil Soup')
        await page.goto(`/clip?text=${encodeURIComponent(recipeText(title))}`)

        await expect(page).toHaveURL(/\/login\?next=/)
        await expect(page.getByRole('heading', { level: 1, name: 'ClipCook' })).toBeVisible()
        await page.getByRole('button', { name: 'Continue as demo cook' }).click()

        await expect(page).toHaveURL(/\/clip\?text=/)
        await expectReview(page, title, 'crushed tomatoes', 'simmer for 30 minutes')
        await saveAndExpectRecipe(page, title, '1 can (14 oz) crushed tomatoes', 'simmer for 30 minutes')
    })
})

test('clip by text: paste, review, save, and the recipe page matches', async ({ page }, testInfo) => {
    const title = unique(testInfo, 'Smoky Tomato White Beans')
    await page.goto('/clip?mode=text')
    await page.getByRole('textbox', { name: 'Recipe text' }).fill(recipeText(title))
    await page.getByRole('button', { name: 'Find recipe' }).click()

    await expectReview(page, title, '1 large onion, sliced', 'Stir in the garlic and paprika')
    await expect(page.getByRole('region', { name: 'Ingredients' }).getByRole('listitem')).toHaveCount(6)
    await saveAndExpectRecipe(page, title, '2 cups cooked white beans', 'Stir in the garlic and paprika')

    const steps = page.getByRole('region', { name: 'Steps' }).getByRole('listitem')
    await expect(steps).toHaveCount(3)
    await expect(steps.nth(2)).toContainText('Add the tomatoes and beans')
    await expect(page.getByRole('region', { name: 'Ingredients' }).getByRole('checkbox')).toHaveCount(6)
    await expect(page.getByRole('term').filter({ hasText: 'Serves' })).toBeVisible()
    await expect(page.getByRole('definition').filter({ hasText: /^4$/ })).toBeVisible()
})

const BOOKMARKLET_CASES = [
    {
        file: 'jsonld-graph.html',
        title: 'Weeknight Chili & Cornbread',
        site: 'Pepper & Pot',
        ingredient: '1 1/2 pounds ground beef',
        savedIngredient: '1½ pounds ground beef',
        step: 'Brown the beef, 6 to 8 minutes.',
    },
    {
        file: 'wprm.html',
        title: 'Garlic Noodles',
        site: 'Wok Night',
        ingredient: '10 cloves garlic, minced',
        savedIngredient: '10 cloves garlic, minced',
        step: 'Melt butter, add garlic, cook 2 minutes.',
    },
]

for (const c of BOOKMARKLET_CASES) {
    test(`bookmarklet post of ${c.file} redirects to the review and saves`, async ({ page }, testInfo) => {
        const html = fixture(c.file)
        // What the bookmarklet reads off the page: every JSON-LD block plus the page markup.
        const jsonld = [...html.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? '')
        const pageUrl = `https://recipes.example/${encodeURIComponent(unique(testInfo, c.file))}`
        const form = new FormData()
        form.append('url', pageUrl)
        form.append('title', c.title)
        form.append('html', html)
        for (const block of jsonld) form.append('jsonld', block)

        const response = await page.request.post(`/api/clip?url=${encodeURIComponent(pageUrl)}`, {
            multipart: form,
            maxRedirects: 0,
        })
        expect(response.status()).toBe(303)
        const location = new URL(response.headers().location ?? '', 'http://localhost')
        expect(location.pathname).toBe('/clip')
        expect(location.searchParams.get('draft')).toMatch(/^[\w-]+$/)

        await page.goto(`${location.pathname}${location.search}`)
        await expectReview(page, c.title, c.ingredient, c.step)
        await saveAndExpectRecipe(page, c.title, c.savedIngredient, c.step)
        await expect(page.getByRole('link', { name: `Original on ${c.site}` })).toHaveAttribute('href', pageUrl)
    })
}

test.describe('clip by URL', () => {
    let server: http.Server
    let origin: string

    test.beforeAll(async () => {
        server = http.createServer((req, res) => {
            if (req.url === '/recipes/garlic-noodles') {
                res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
                res.end(fixture('wprm.html'))
            } else {
                res.writeHead(404)
                res.end()
            }
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
        origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    })

    test.afterAll(async () => {
        await new Promise((resolve) => server.close(resolve))
    })

    // The happy path needs CLIPCOOK_CLIP_ALLOW_PRIVATE=1, which production builds ignore
    // by design, and this suite runs the production build. Running `next dev` beside it
    // would double the servers CI has to start for one test, so the fetch-and-parse path
    // is covered by tests/unit/clip-flow.test.ts against a local server instead.
    test.skip('clips a page from a local fixture server (needs next dev)', () => {})

    test('production refuses to fetch a private address, even with the dev flag', async ({ page }) => {
        let hits = 0
        server.on('request', () => {
            hits += 1
        })
        await page.goto('/clip?mode=link')
        await page.getByRole('textbox', { name: 'Link' }).fill(`${origin}/recipes/garlic-noodles`)
        await page.getByRole('main').getByRole('button', { name: 'Clip', exact: true }).click()
        await expect(page.getByText('That address cannot be clipped.')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Paste text instead' })).toBeVisible()
        expect(hits).toBe(0)
    })
})
