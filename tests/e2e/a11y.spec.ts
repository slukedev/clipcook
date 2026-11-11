import { expect, test } from './support/fixtures'

const PAGES = [
    '/',
    '/collections',
    '/plan',
    '/plan?week=2026-11-30',
    '/grocery',
    '/settings',
    '/settings/displays',
    '/link',
    '/new',
    '/clip?mode=link',
    '/clip?mode=text',
]

for (const path of PAGES) {
    test(`${path} has one h1, one main, and no horizontal overflow at 320px`, async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 640 })
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
        await expect(page.getByRole('main')).toHaveCount(1)
        await page.evaluate(() => document.fonts.ready)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, 'page is wider than the viewport').toBeLessThanOrEqual(0)
    })
}

test('a recipe page and its cook mode have one h1 and fit 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto('/?q=Spicy%20Miso%20Ramen')
    await page.getByRole('list', { name: 'Recipes' }).getByRole('link', { name: 'Spicy Miso Ramen' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Spicy Miso Ramen' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await page.evaluate(() => document.fonts.ready)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)

    await page.getByRole('link', { name: 'Cook', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Spicy Miso Ramen' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
})

test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('/login has one h1 and fits 320px', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 640 })
        await page.goto('/login')
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
        await expect(page.getByRole('main')).toHaveCount(1)
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(
            0,
        )
    })
})
