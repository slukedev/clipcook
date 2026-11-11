import { expect, test } from './support/fixtures'

test('add lines, check one into Done, and clear the checked items', async ({ page }, testInfo) => {
    // Letters only, so the grocery parser keeps the whole word in the item name.
    const word = `${testInfo.project.name.replace(/\W/g, '')}${Date.now().toString(36).replace(/\d/g, '')}`
    const rice = `${word} rice`
    const herb = `${word} basil`
    await page.goto('/grocery')
    const add = page.getByRole('textbox', { name: 'Add item' })

    await add.fill(`1 cup ${rice}`)
    await add.press('Enter')
    await add.fill(`2 cups ${rice}`)
    await add.press('Enter')
    await add.fill(`1 bunch ${herb}`)
    await add.press('Enter')

    const pantry = page.getByRole('region', { name: 'Pantry' })
    const produce = page.getByRole('region', { name: 'Produce' })
    const done = page.getByRole('region', { name: 'Done' })
    await expect(pantry.getByRole('checkbox', { name: `3 cups ${rice}` })).toBeVisible()
    await expect(page.getByRole('main').getByRole('checkbox', { name: new RegExp(rice) })).toHaveCount(1)
    await expect(produce.getByRole('checkbox', { name: `1 bunch ${herb}` })).toBeVisible()

    await page.reload()
    await expect(pantry.getByRole('checkbox', { name: `3 cups ${rice}` })).toBeVisible()

    // Checking moves the row to Done, so click rather than check() the row that leaves.
    await pantry.getByRole('checkbox', { name: `3 cups ${rice}` }).click()
    await expect(done.getByRole('checkbox', { name: `3 cups ${rice}` })).toBeChecked()
    await expect(pantry.getByRole('checkbox', { name: `3 cups ${rice}` })).toHaveCount(0)

    await page.reload()
    await expect(done.getByRole('checkbox', { name: `3 cups ${rice}` })).toBeChecked()

    await done.getByRole('button', { name: 'Clear' }).click()
    await expect(done).toBeHidden()
    await expect(page.getByRole('main').getByRole('checkbox', { name: new RegExp(rice) })).toHaveCount(0)
    await expect(produce.getByRole('checkbox', { name: `1 bunch ${herb}` })).not.toBeChecked()

    await page.reload()
    await expect(page.getByRole('main').getByRole('checkbox', { name: new RegExp(rice) })).toHaveCount(0)
    await expect(page.getByRole('main').getByRole('checkbox', { checked: true })).toHaveCount(0)
    await expect(produce.getByRole('checkbox', { name: `1 bunch ${herb}` })).toBeVisible()
})

test('checks made offline stay put and sync when the connection is back', async ({
    page,
    context,
    consoleProblems,
}, testInfo) => {
    const word = `${testInfo.project.name.replace(/\W/g, '')}${Date.now().toString(36).replace(/\d/g, '')}`
    const item = `${word} oats`
    await page.goto('/grocery')
    const add = page.getByRole('textbox', { name: 'Add item' })
    await add.fill(item)
    await add.press('Enter')
    const main = page.getByRole('main')
    await expect(main.getByRole('checkbox', { name: item })).not.toBeChecked()
    // Let the add reach the server before the connection drops.
    await page.waitForLoadState('networkidle')

    await context.setOffline(true)
    await main.getByRole('checkbox', { name: item }).click()
    await expect(page.getByText('Offline', { exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Done' }).getByRole('checkbox', { name: item })).toBeChecked()

    await context.setOffline(false)
    await expect(page.getByText('Offline', { exact: true })).toBeHidden({ timeout: 20_000 })
    await page.reload()
    await expect(page.getByRole('region', { name: 'Done' }).getByRole('checkbox', { name: item })).toBeChecked()

    await main.getByRole('button', { name: `Delete ${item}` }).click()
    await expect(main.getByRole('checkbox', { name: item })).toHaveCount(0)

    // The browser reports the requests that failed while offline; those are expected here.
    const expected = /ERR_INTERNET_DISCONNECTED|Failed to fetch|Failed to load resource/
    consoleProblems.splice(0, consoleProblems.length, ...consoleProblems.filter((p) => !expected.test(p)))
})

test('something bought before goes back on the list in one tap', async ({ page }, testInfo) => {
    const word = `${testInfo.project.name.replace(/\W/g, '')}${Date.now().toString(36).replace(/\d/g, '')}`
    const item = `${word} flakes`
    await page.goto('/grocery')
    const add = page.getByRole('textbox', { name: 'Add item' })
    await add.fill(`2 cups ${item}`)
    await add.press('Enter')
    const main = page.getByRole('main')
    await main.getByRole('button', { name: new RegExp(`Delete .*${item}`) }).click()
    await expect(main.getByRole('checkbox', { name: new RegExp(item) })).toHaveCount(0)

    await add.focus()
    await add.fill(word)
    await main.getByRole('button', { name: item, exact: true }).click()
    await expect(main.getByRole('checkbox', { name: item })).toBeVisible()
    await main.getByRole('button', { name: `Delete ${item}` }).click()
})
