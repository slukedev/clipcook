import { readFileSync, writeFileSync } from 'node:fs'
import { expect, test, unique } from './support/fixtures'
import { type ExportFile, exportLibrary } from './support/library'

test('the theme choice applies at once and persists after a reload', async ({ page }) => {
    await page.goto('/settings')
    const theme = page.getByRole('group', { name: 'Theme' })
    const html = page.locator('html')

    await theme.getByRole('button', { name: 'Dark' }).click()
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await expect(theme.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await expect(theme.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')

    // Other pages render dark from the first byte, not only after hydration.
    const response = await page.request.get('/grocery')
    expect(await response.text()).toMatch(/<html[^>]*data-theme="dark"/)

    await theme.getByRole('button', { name: 'Light' }).click()
    await expect(html).toHaveAttribute('data-theme', 'light')
    await theme.getByRole('button', { name: 'System' }).click()
    await expect(html).not.toHaveAttribute('data-theme', /./)
    await page.reload()
    await expect(html).not.toHaveAttribute('data-theme', /./)
    await expect(theme.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true')
})

test('export downloads the library as JSON and importing it back reports counts', async ({ page }, testInfo) => {
    await page.goto('/settings')
    const downloading = page.waitForEvent('download')
    await page.getByRole('button', { name: /^Export/ }).click()
    const download = await downloading
    expect(download.suggestedFilename()).toMatch(/^clipcook-\d{4}-\d{2}-\d{2}\.json$/)

    const file = testInfo.outputPath('export.json')
    await download.saveAs(file)
    const exported = JSON.parse(readFileSync(file, 'utf8')) as ExportFile
    expect(exported.schema).toBe('clipcook.export.v1')
    const library = await exportLibrary(page)
    expect(exported.recipes.map((r) => r.id).sort()).toEqual(library.recipes.map((r) => r.id).sort())
    expect(exported.collections.length).toBe(library.collections.length)

    // Add one new recipe to the file: it is imported and every existing one is recognized.
    // One import only, since imports are rate limited to 3 per 10 minutes per account.
    const title = unique(testInfo, 'Imported Rhubarb Crumble')
    const base = exported.recipes[0]
    expect(base).toBeDefined()
    exported.recipes.push({
        ...(base as ExportFile['recipes'][number]),
        id: `import-${Date.now()}`,
        title,
        ingredients: ['4 stalks rhubarb', '1 cup oats'],
    })
    const changed = testInfo.outputPath('export-plus-one.json')
    writeFileSync(changed, JSON.stringify(exported))
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: /^Import/ }).click()
    await (await chooser).setFiles(changed)
    await expect(page.getByRole('region', { name: 'Notifications' })).toContainText(
        `Imported 1 recipe, skipped ${exported.recipes.length - 1} already here`,
    )

    await page.goto(`/?q=${encodeURIComponent(title)}`)
    await expect(page.getByRole('list', { name: 'Recipes' }).getByRole('link', { name: title })).toBeVisible()
})
