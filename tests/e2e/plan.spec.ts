import type { Page } from '@playwright/test'
import { addDays, weekStartOf } from '../../src/lib/plan/week'
import { expect, test } from './support/fixtures'
import { openRecipe } from './support/library'

const RAMEN = 'Spicy Miso Ramen'

/** Empties the week on screen, so every test starts from a calm week. */
async function clearWeek(page: Page, path: string) {
    await page.goto(path)
    await page.getByRole('button', { name: 'Week options' }).click()
    const clear = page.getByRole('menuitem', { name: 'Clear week' })
    if (await clear.isDisabled()) {
        await page.keyboard.press('Escape')
        return
    }
    await clear.click()
    await expect(page.getByRole('region', { name: 'Notifications' }).getByText('Week cleared')).toBeVisible()
}

/** The week after the one the page shows, read from its own Next link. */
async function nextWeekHref(page: Page): Promise<string> {
    return (await page.getByRole('link', { name: 'Next week' }).getAttribute('href')) ?? '/plan'
}

test.beforeEach(async ({ page }) => {
    await clearWeek(page, '/plan')
    await clearWeek(page, await nextWeekHref(page))
})

test.afterEach(async ({ page }) => {
    // Leave the library without a Tonight card for the specs that follow.
    await clearWeek(page, '/plan')
    await clearWeek(page, await nextWeekHref(page))
})

test('plan tonight, see it in the library, move it, scale it and shop for it', async ({ page }) => {
    await page.goto('/grocery')
    await page.getByRole('button', { name: 'More' }).click()
    const clearList = page.getByRole('menuitem', { name: 'Clear list' })
    if (await clearList.isEnabled()) {
        await clearList.click()
        await page.getByRole('alertdialog').getByRole('button', { name: 'Clear' }).click()
    } else {
        await page.keyboard.press('Escape')
    }

    await page.goto('/plan')
    await expect(page.getByRole('heading', { name: 'Nothing Planned Tonight' })).toBeVisible()
    await page.getByRole('button', { name: 'Find a recipe' }).click()
    const sheet = page.getByRole('dialog')
    await sheet.getByRole('searchbox').fill(RAMEN)
    await sheet
        .getByRole('button', { name: new RegExp(RAMEN) })
        .first()
        .click()
    await expect(sheet.getByRole('button', { name: new RegExp(RAMEN) }).first()).toHaveAttribute('aria-pressed', 'true')
    await sheet.getByRole('button', { name: 'Done' }).click()

    const tonight = page.getByRole('region', { name: `Tonight: ${RAMEN}` })
    await expect(tonight).toBeVisible()
    await expect(tonight.getByRole('link', { name: 'Cook' })).toHaveAttribute('href', /\/cook$/)

    await page.reload()
    await expect(page.getByRole('region', { name: `Tonight: ${RAMEN}` })).toBeVisible()

    await page.goto('/')
    const libraryTonight = page.getByRole('region', { name: `Tonight: ${RAMEN}` })
    await expect(libraryTonight).toBeVisible()
    await expect(libraryTonight.getByRole('link', { name: `Cook ${RAMEN}` })).toBeVisible()

    // Move to the same day next week with the keyboard-friendly menu.
    await page.goto('/plan')
    await page.getByRole('button', { name: `${RAMEN} options` }).click()
    await page.getByRole('menuitem', { name: 'Move to' }).click()
    await page.getByRole('menuitem', { name: /^Next / }).click()
    await expect(page.getByRole('heading', { name: 'Nothing Planned Tonight' })).toBeVisible()
    await page.getByRole('button', { name: 'Show' }).click()
    await expect(page).toHaveURL(/\/plan\?week=\d{4}-\d{2}-\d{2}$/)
    const entry = page.getByRole('listitem').filter({ hasText: RAMEN })
    await expect(entry).toBeVisible()

    await page.getByRole('button', { name: `${RAMEN} options` }).click()
    await page.getByRole('menuitem', { name: 'Servings' }).click()
    const dialog = page.getByRole('dialog', { name: 'Servings' })
    await expect(dialog.getByRole('textbox', { name: 'Servings' })).toHaveValue('4')
    await dialog.getByRole('button', { name: 'Increase servings' }).click()
    await dialog.getByRole('button', { name: 'Increase servings' }).click()
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(entry).toContainText('6 servings')
    await page.reload()
    await expect(page.getByRole('listitem').filter({ hasText: RAMEN })).toContainText('6 servings')

    const shopButton = page.getByRole('button', { name: 'Add 1 recipe to list' })
    if (await shopButton.isVisible()) {
        await shopButton.click()
    } else {
        await page.getByRole('button', { name: 'Week options' }).click()
        await page.getByRole('menuitem', { name: 'Add 1 recipe to list' }).click()
    }
    await page.getByRole('button', { name: 'View list' }).click()
    await expect(page).toHaveURL(/\/grocery$/)
    // 8 cups for 4 servings, scaled to 6.
    await expect(
        page.getByRole('region', { name: 'Pantry' }).getByRole('checkbox', { name: '12 cups chicken stock' }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: RAMEN })).toBeVisible()
})

test('remove a meal and bring it back with Undo', async ({ page }) => {
    await page.goto('/plan')
    await page.getByRole('button', { name: 'Find a recipe' }).click()
    const sheet = page.getByRole('dialog')
    await sheet.getByRole('button', { name: 'Leftovers' }).click()
    await sheet.getByRole('button', { name: 'Done' }).click()
    const leftovers = page.getByRole('listitem').filter({ hasText: 'Leftovers' })
    await expect(leftovers).toBeVisible()

    await page.getByRole('button', { name: 'Leftovers options' }).click()
    await page.getByRole('menuitem', { name: 'Remove' }).click()
    await expect(leftovers).toHaveCount(0)
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(leftovers).toBeVisible()
    await page.reload()
    await expect(page.getByRole('listitem').filter({ hasText: 'Leftovers' })).toBeVisible()
})

test('add a recipe to next week from its page', async ({ page }) => {
    await openRecipe(page, RAMEN)
    await page.getByRole('button', { name: 'More options' }).click()
    await page.getByRole('menuitem', { name: 'Add to plan' }).click()
    const sheet = page.getByRole('dialog', { name: 'Add to Plan' })
    const nextWeek = sheet.getByRole('group', { name: 'Next week' })
    await nextWeek.getByRole('button').first().click()
    await sheet.getByRole('button', { name: 'Lunch' }).click()
    await sheet.getByRole('button', { name: 'Add to plan' }).click()
    await expect(sheet).toBeHidden()
    await page.getByRole('button', { name: 'View plan' }).click()
    await expect(page).toHaveURL(/\/plan\?week=/)
    await expect(page.getByRole('listitem').filter({ hasText: RAMEN })).toContainText('Lunch')
})

test('deep links open any week, and This week comes back', async ({ page }) => {
    await page.goto('/plan?week=2027-01-01')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Dec 2[78], 2026 to Jan [23], 2027$/)
    await expect(page.getByRole('heading', { name: 'Nothing Planned Tonight' })).toHaveCount(0)

    await page.getByRole('link', { name: 'Next week' }).click()
    await expect(page).toHaveURL(/week=2027-01-0[34]$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Jan (3 to 9|4 to 10), 2027$/)

    await page.getByRole('link', { name: 'This week' }).click()
    await expect(page).toHaveURL(/\/plan$/)
    await expect(page.getByRole('link', { name: 'This week' })).toHaveCount(0)

    // Anything that is not a real date falls back to this week.
    await page.goto('/plan?week=2026-02-30')
    await expect(page.getByRole('link', { name: 'This week' })).toHaveCount(0)
    const today = new Date().toISOString().slice(0, 10)
    const start = await page.getByRole('link', { name: 'Next week' }).getAttribute('href')
    const shown = addDays(start?.split('=')[1] ?? today, -7)
    expect([weekStartOf(today, 'sunday'), weekStartOf(today, 'monday')]).toContain(shown)
})
