import type { Page } from '@playwright/test'
import { BASE_URL } from './support/env'
import { expect, test, unique, watchConsole } from './support/fixtures'
import { openRecipe } from './support/library'

const TITLE = 'Shakshuka with Feta and Herbs'

/** With one display the recipe page offers "Show on <name>"; with more, a menu. */
async function showOn(page: Page, name: string) {
    const direct = page.getByRole('button', { name: `Show on ${name}` })
    const menu = page.getByRole('button', { name: 'Send to display' })
    await expect(direct.or(menu)).toBeVisible()
    if (await direct.isVisible()) {
        await direct.click()
    } else {
        await menu.click()
        await page.getByRole('menuitem', { name }).click()
    }
}

test('pair a kitchen display, send a recipe, follow cook mode, then unlink it', async ({
    page,
    browser,
    consoleProblems,
}, testInfo) => {
    const name = unique(testInfo, 'Counter').slice(0, 30)

    // The display is another device: its own context, never signed in.
    const displayContext = await browser.newContext({
        baseURL: BASE_URL,
        storageState: { cookies: [], origins: [] },
        viewport: { width: 1280, height: 800 },
    })
    const display = await displayContext.newPage()
    // Once unlinked, the display's state poll is answered 401 (its cue to return to pairing),
    // and Chromium logs every failed fetch.
    watchConsole(display, consoleProblems, [/status of 401 \(Unauthorized\)/])
    try {
        await display.goto('/display')
        await expect(display.getByRole('heading', { level: 1, name: 'Link This Display' })).toBeVisible()
        const spoken = await display.getByText(/^Code( [A-Z0-9])+$/).textContent()
        const code = (spoken ?? '').replace(/^Code /, '').replaceAll(' ', '')
        expect(code).toMatch(/^[A-Z0-9]{6}$/)

        await page.goto('/link')
        await expect(page.getByRole('heading', { level: 1, name: 'Link a Display' })).toBeVisible()
        await page.getByRole('textbox', { name: 'Code on the display' }).fill(code)
        await page.getByRole('textbox', { name: 'Name' }).fill(name)
        await page.getByRole('button', { name: 'Link display' }).click()
        await expect(page.getByRole('heading', { name: `${name} is ready` })).toBeVisible()

        // The display notices the claim on its next poll and leaves pairing.
        await expect(display.getByRole('heading', { level: 1, name: 'Link This Display' })).toBeHidden({
            timeout: 15_000,
        })

        await openRecipe(page, TITLE)
        await showOn(page, name)
        // The wording depends on how recently the display checked in; the display itself is the proof.
        await expect(page.getByRole('region', { name: 'Notifications' })).toContainText(name)
        await expect(display).toHaveURL(/\/display\/r\/[\w-]+$/, { timeout: 15_000 })
        await expect(display.getByRole('heading', { level: 1, name: TITLE })).toBeVisible()

        // Cook mode with display sync on: the display follows each step.
        await page.getByRole('link', { name: 'Cook', exact: true }).click()
        const counter = page.getByRole('banner').getByText(/^Step \d+ of \d+$/)
        await expect(counter).toHaveText(/^Step 1 of /)
        const sync = page
            .getByRole('button', { name: `Show on ${name}` })
            .or(page.getByRole('button', { name: 'Show on display' }))
        if (await page.getByRole('button', { name: `Show on ${name}` }).isVisible()) {
            await sync.click()
            await expect(page.getByRole('button', { name: `Show on ${name}` })).toHaveAttribute('aria-pressed', 'true')
        } else {
            await sync.click()
            await page.getByRole('menuitemradio', { name }).click()
        }
        await page.keyboard.press('ArrowRight')
        await page.keyboard.press('ArrowRight')
        await expect(counter).toHaveText(/^Step 3 of /)
        const total = Number((await counter.textContent())?.match(/of (\d+)/)?.[1])
        await expect(display.getByRole('region', { name: `Step 3 of ${total}` })).toBeVisible({ timeout: 15_000 })

        await page.keyboard.press('ArrowLeft')
        await expect(display.getByRole('region', { name: `Step 2 of ${total}` })).toBeVisible({ timeout: 15_000 })
        await page.keyboard.press('Escape')

        // Removing the display signs it out; it goes back to showing a pairing code.
        await page.goto('/settings/displays')
        await page.getByRole('button', { name: `${name} options` }).click()
        await page.getByRole('menuitem', { name: 'Remove' }).click()
        const confirm = page.getByRole('alertdialog', { name: `Remove ${name}?` })
        await confirm.getByRole('button', { name: 'Remove' }).click()
        await expect(confirm).toBeHidden()
        await expect(page.getByRole('heading', { name })).toHaveCount(0)

        await expect(display.getByRole('heading', { level: 1, name: 'Link This Display' })).toBeVisible({
            timeout: 15_000,
        })
        await expect(display).toHaveURL(/\/display$/)
        await expect(display.getByText(/^Code( [A-Z0-9])+$/)).not.toHaveText(`Code ${code.split('').join(' ')}`)
    } finally {
        await displayContext.close()
    }
})
