import { expect, test } from './support/fixtures'
import { exportLibrary, openRecipe } from './support/library'

const TITLE = 'Crispy Tofu and Broccoli Stir-Fry'

test('cook mode opens on an overview, pages by keyboard, Done records the cook, Escape leaves', async ({ page }) => {
    const before = (await exportLibrary(page)).recipes.find((r) => r.title === TITLE)
    expect(before).toBeDefined()
    const recipePath = await openRecipe(page, TITLE)
    const stepCount = await page.getByRole('region', { name: 'Steps' }).getByRole('listitem').count()
    expect(stepCount).toBeGreaterThan(2)

    await page.getByRole('link', { name: 'Cook', exact: true }).click()
    await expect(page).toHaveURL(`${recipePath}/cook`)
    const counter = page.getByRole('banner').getByText(/^(Step \d+ of \d+|\d+ steps?)$/)
    // A fresh cook opens on what to gather and get out before step 1.
    await expect(page.getByRole('heading', { name: 'Before You Start' })).toBeVisible()
    await expect(counter).toHaveText(`${stepCount} steps`)
    await expect(page.getByRole('contentinfo').getByRole('button', { name: 'Back' })).toHaveCount(0)

    // The server-rendered page shows the overview before its key handler hydrates; a key
    // pressed earlier is lost, so press until the first one lands (never twice once it has).
    await expect(async () => {
        if ((await counter.textContent()) !== `Step 1 of ${stepCount}`) await page.keyboard.press('ArrowRight')
        await expect(counter).toHaveText(`Step 1 of ${stepCount}`, { timeout: 1000 })
    }).toPass()
    // Back from step 1 returns to the overview, and Start goes again.
    await page.keyboard.press('ArrowLeft')
    await expect(counter).toHaveText(`${stepCount} steps`)
    await page.getByRole('contentinfo').getByRole('button', { name: 'Start' }).click()
    await expect(counter).toHaveText(`Step 1 of ${stepCount}`)
    for (let step = 2; step <= stepCount; step++) {
        await page.keyboard.press('ArrowRight')
        await expect(counter).toHaveText(`Step ${step} of ${stepCount}`)
    }
    await expect(page.getByRole('progressbar', { name: 'Progress' })).toHaveAttribute(
        'aria-valuenow',
        String(stepCount),
    )
    // Past the last step the arrow key finishes, so use the visible Done button instead.
    const done = page.getByRole('contentinfo').getByRole('button', { name: 'Done' })
    await expect(done).toBeVisible()
    await done.click()

    await expect(page).toHaveURL(recipePath)
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible()
    await expect
        .poll(async () => (await exportLibrary(page)).recipes.find((r) => r.title === TITLE)?.cookCount)
        .toBe((before?.cookCount ?? 0) + 1)

    // The library leads "Jump Back In" with what was just cooked.
    await page.goto('/')
    await expect(
        page
            .getByRole('region', { name: 'Jump Back In' })
            .getByRole('group', { name: /^1 of / })
            .getByRole('link'),
    ).toHaveAccessibleName(TITLE)

    // A finished cook starts again from the top; Escape leaves without marking anything.
    await page.goto(recipePath)
    await page.getByRole('link', { name: 'Cook', exact: true }).click()
    await expect(counter).toHaveText(`${stepCount} steps`)
    await page.keyboard.press('ArrowRight')
    await expect(counter).toHaveText(`Step 1 of ${stepCount}`)
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(recipePath)
    expect((await exportLibrary(page)).recipes.find((r) => r.title === TITLE)?.cookCount).toBe(
        (before?.cookCount ?? 0) + 1,
    )
})
