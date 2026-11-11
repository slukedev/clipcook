import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { openRecipe } from './support/library'

const PANCAKES = 'Lemon Blueberry Buttermilk Pancakes'

/** Whole-number quantity of an unchecked grocery item, 0 when the list does not have it. */
async function groceryQuantity(page: Page, name: string): Promise<number> {
    await page.goto('/grocery')
    await expect(page.getByRole('heading', { level: 1, name: 'Grocery List' })).toBeVisible()
    const item = page
        .getByRole('main')
        .getByRole('checkbox', { name: new RegExp(`^\\d+ cups? ${name}$`), checked: false })
    if ((await item.count()) === 0) return 0
    // The snapshot carries the accessible name, e.g. `- checkbox "4 cups buttermilk"`.
    const match = (await item.ariaSnapshot()).match(/"(\d+) cups?/)
    return Number(match?.[1])
}

async function addFlourAndButtermilk(page: Page) {
    await page.getByRole('region', { name: 'Ingredients' }).getByRole('button', { name: 'Add to list' }).click()
    const sheet = page.getByRole('dialog', { name: 'Add to Grocery List' })
    await sheet.getByRole('checkbox', { name: 'Select all' }).uncheck()
    await sheet.getByRole('checkbox', { name: '4 cups all-purpose flour' }).check()
    await sheet.getByRole('checkbox', { name: '4 cups buttermilk' }).check()
    await sheet.getByRole('button', { name: 'Add 2' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('region', { name: 'Notifications' })).toContainText('Added 2 items')
}

test('scaling servings rescales the ingredient quantities', async ({ page }) => {
    await openRecipe(page, PANCAKES)
    const ingredients = page.getByRole('region', { name: 'Ingredients' })
    const servings = ingredients.getByRole('textbox', { name: 'Servings' })
    await expect(servings).toHaveValue('4')
    await expect(ingredients.getByRole('checkbox', { name: '2 cups all-purpose flour' })).toBeVisible()

    await ingredients.getByRole('button', { name: 'Double' }).click()
    await expect(servings).toHaveValue('8')
    await expect(ingredients.getByRole('checkbox', { name: '4 cups all-purpose flour' })).toBeVisible()
    await expect(ingredients.getByRole('checkbox', { name: '4 cups buttermilk' })).toBeVisible()
    await expect(ingredients.getByRole('checkbox', { name: '3 cups blueberries' })).toBeVisible()

    await ingredients.getByRole('button', { name: 'Half' }).click()
    await expect(servings).toHaveValue('2')
    await expect(ingredients.getByRole('checkbox', { name: '1 cup all-purpose flour' })).toBeVisible()

    await ingredients.getByRole('button', { name: 'Increase servings' }).click()
    await expect(servings).toHaveValue('3')
    await expect(ingredients.getByRole('checkbox', { name: '1½ cups all-purpose flour' })).toBeVisible()

    await ingredients.getByRole('button', { name: 'Original' }).click()
    await expect(servings).toHaveValue('4')
    await expect(ingredients.getByRole('checkbox', { name: '2 cups all-purpose flour' })).toBeVisible()
})

test('checking an ingredient sticks across a reload', async ({ page }) => {
    await openRecipe(page, PANCAKES)
    const eggs = page.getByRole('region', { name: 'Ingredients' }).getByRole('checkbox', { name: '2 large eggs' })
    await eggs.check()
    await expect(eggs).toBeChecked()
    await page.reload()
    await expect(eggs).toBeChecked()
    await eggs.uncheck()
    await expect(eggs).not.toBeChecked()
})

test('a timer chip starts a countdown that shows in the timer tray', async ({ page }) => {
    await page.clock.install()
    await openRecipe(page, PANCAKES)
    // From here time only moves when the test says so, so the clock readings are exact.
    await page.clock.pauseAt(Date.now() + 60_000)
    const steps = page.getByRole('region', { name: 'Steps' })
    await steps.getByRole('button', { name: 'Start 10 minutes timer' }).click()

    const chip = steps.getByRole('button', { name: /^Pause timer, \d+:\d\d left$/ })
    await expect(chip).toBeVisible()
    const tray = page.getByRole('region', { name: 'Timers' })
    await expect(tray.getByText('Step 3')).toBeVisible()
    await expect(tray.getByRole('timer')).toHaveText('10:00')

    // The clock repaints on whole seconds of wall time, so allow for one second of phase.
    await page.clock.runFor(61_000)
    const clock = tray.getByRole('timer')
    await expect(clock).toHaveText(/^(8:59|9:00)$/)
    const shown = (await clock.textContent()) ?? ''
    await expect(steps.getByRole('button', { name: `Pause timer, ${shown} left` })).toBeVisible()

    await tray.getByRole('button', { name: 'Pause Step 3' }).click()
    await expect(steps.getByRole('button', { name: /^Resume timer, \d+:\d\d left$/ })).toBeVisible()
    const paused = (await clock.textContent()) ?? ''
    await page.clock.runFor(30_000)
    await expect(clock).toHaveText(paused)
    await expect(steps.getByRole('button', { name: `Resume timer, ${paused} left` })).toBeVisible()

    await tray.getByRole('button', { name: 'Cancel Step 3' }).click()
    await expect(tray).toBeHidden()
    await expect(steps.getByRole('button', { name: 'Start 10 minutes timer' })).toBeVisible()
})

test('adding scaled ingredients to the grocery list merges and groups them by aisle', async ({ page }) => {
    const flourBefore = await groceryQuantity(page, 'all-purpose flour')
    const buttermilkBefore = await groceryQuantity(page, 'buttermilk')

    await openRecipe(page, PANCAKES)
    const ingredients = page.getByRole('region', { name: 'Ingredients' })
    await ingredients.getByRole('button', { name: 'Double' }).click()

    // Twice, so the second batch has to merge into the first.
    await addFlourAndButtermilk(page)
    await addFlourAndButtermilk(page)
    await ingredients.getByRole('button', { name: 'Original' }).click()

    await page.goto('/grocery')
    const pantry = page.getByRole('region', { name: 'Pantry' })
    const dairy = page.getByRole('region', { name: 'Dairy and Eggs' })
    await expect(pantry.getByRole('checkbox', { name: `${flourBefore + 8} cups all-purpose flour` })).toBeVisible()
    await expect(dairy.getByRole('checkbox', { name: `${buttermilkBefore + 8} cups buttermilk` })).toBeVisible()
    await expect(page.getByRole('main').getByRole('checkbox', { name: /all-purpose flour$/ })).toHaveCount(1)
    await expect(page.getByRole('region', { name: 'From Recipes' }).getByRole('link', { name: PANCAKES })).toBeVisible()
})
