import { expect, type Locator, type Page } from '@playwright/test'

export interface ExportedRecipe {
    id: string
    title: string
    tags: string[]
    favorite: boolean
    sourceName: string | null
    cookCount: number
    lastCookedAt: number | null
    ingredients: string[]
}

export interface ExportFile {
    schema: string
    recipes: ExportedRecipe[]
    collections: { id: string; name: string }[]
    grocery: { text: string; checked: boolean }[]
}

/** The server's view of the library, read the way a user would back it up. */
export async function exportLibrary(page: Page): Promise<ExportFile> {
    const response = await page.request.get('/api/export')
    expect(response.ok()).toBe(true)
    return (await response.json()) as ExportFile
}

export function recipeGrid(page: Page): Locator {
    return page.getByRole('list', { name: 'Recipes' })
}

/** Card titles in display order. textContent, because off-screen cards skip rendering. */
export async function cardTitles(page: Page): Promise<string[]> {
    return (await recipeGrid(page).getByRole('heading', { level: 3 }).allTextContents()).map((t) => t.trim())
}

export function sorted(titles: string[]): string[] {
    return titles.toSorted((a, b) => a.localeCompare(b))
}

/** Opens a seeded recipe from the library search, the way a cook would find it. */
export async function openRecipe(page: Page, title: string): Promise<string> {
    await page.goto(`/?q=${encodeURIComponent(title)}`)
    await recipeGrid(page).getByRole('link', { name: title, exact: true }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    return new URL(page.url()).pathname
}
