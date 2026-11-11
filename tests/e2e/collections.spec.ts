import { expect, test, unique } from './support/fixtures'
import { exportLibrary, recipeGrid } from './support/library'

test('create a collection, fill it from the picker, open it, remove a recipe, delete it', async ({
    page,
}, testInfo) => {
    const name = unique(testInfo, 'Sunday')
    const picks = ['Spicy Miso Ramen', 'Overnight Oats with Berries']

    await page.goto('/collections')
    await page.getByRole('button', { name: 'New collection' }).click()
    const dialog = page.getByRole('dialog', { name: 'New Collection' })
    await dialog.getByRole('textbox', { name: 'Name' }).fill(name)
    await dialog.getByRole('button', { name: 'Create' }).click()

    await expect(page).toHaveURL(/\/collections\/[\w-]+$/)
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Nothing Here Yet' })).toBeVisible()

    await page.getByRole('button', { name: 'Add recipes' }).click()
    const picker = page.getByRole('dialog', { name: `Add to ${name}` })
    for (const title of picks) {
        await picker.getByRole('searchbox').fill(title)
        await picker.getByRole('checkbox', { name: title }).check()
    }
    await picker.getByRole('button', { name: 'Save' }).first().click()
    await expect(picker).toBeHidden()
    await expect(page.getByRole('region', { name: 'Notifications' })).toContainText('Added 2 recipes')

    const members = page.getByRole('list', { name })
    await expect(members.getByRole('listitem')).toHaveCount(2)
    for (const title of picks) await expect(members.getByRole('link', { name: title })).toBeVisible()

    // Open it from the collections page and from the library filter chip.
    await page.goto('/collections')
    const tile = page.getByRole('list', { name: 'Collections' }).getByRole('listitem').filter({ hasText: name })
    await expect(tile).toContainText('2 recipes')
    await tile.getByRole('link', { name }).click()
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()

    const [kept, removed] = picks as [string, string]
    await members.getByRole('button', { name: `More for ${removed}` }).click()
    await page.getByRole('menuitem', { name: 'Remove from collection' }).click()
    await expect(members.getByRole('listitem')).toHaveCount(1)
    await expect(page.getByRole('region', { name: 'Notifications' })).toContainText(`Removed from ${name}`)

    await page.reload()
    await expect(members.getByRole('listitem')).toHaveCount(1)
    await expect(members.getByRole('link', { name: kept })).toBeVisible()

    await page.goto('/')
    await page.getByRole('group', { name: 'Filter recipes' }).getByRole('button', { name }).click()
    await expect(recipeGrid(page).getByRole('listitem')).toHaveCount(1)
    await expect(recipeGrid(page).getByRole('link', { name: kept })).toBeVisible()

    await page.goto('/collections')
    await page.getByRole('list', { name: 'Collections' }).getByRole('link', { name }).click()
    await page.getByRole('button', { name: 'More', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page
        .getByRole('alertdialog', { name: `Delete ${name}?` })
        .getByRole('button', { name: 'Delete' })
        .click()
    await expect(page).toHaveURL(/\/collections$/)
    await expect(page.getByRole('list', { name: 'Collections' }).getByRole('link', { name })).toHaveCount(0)

    const library = await exportLibrary(page)
    expect(library.collections.map((c) => c.name)).not.toContain(name)
    expect(library.recipes.filter((r) => r.title === kept)).toHaveLength(1)
})
