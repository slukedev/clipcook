import { expect, test, unique } from './support/fixtures'

test('write a recipe at /new, then edit it, with the unsaved-changes guard on Close', async ({ page }, testInfo) => {
    const title = unique(testInfo, 'Charred Corn Salad')
    await page.goto('/new')
    const form = page.getByRole('form', { name: 'New recipe' })
    await form.getByRole('textbox', { name: 'Title' }).fill(title)
    await form.getByRole('textbox', { name: 'Servings' }).fill('4')

    // Enter at the end of a row starts the next one and moves the caret there.
    const ingredients = form.getByRole('region', { name: 'Ingredients' })
    await ingredients.getByRole('textbox', { name: 'Ingredient 1' }).fill('4 ears sweet corn')
    await ingredients.getByRole('textbox', { name: 'Ingredient 1' }).press('End')
    await page.keyboard.press('Enter')
    await expect(ingredients.getByRole('textbox', { name: 'Ingredient 2' })).toBeFocused()
    await page.keyboard.type('1 lime, juiced')
    await page.keyboard.press('Enter')
    await expect(ingredients.getByRole('textbox', { name: 'Ingredient 3' })).toBeFocused()
    await page.keyboard.type('½ cup crumbled cotija')

    const steps = form.getByRole('region', { name: 'Steps' })
    await steps.getByRole('textbox', { name: 'Step 1' }).fill('Char the corn in a dry skillet for 8 minutes.')
    await steps.getByRole('textbox', { name: 'Step 1' }).press('End')
    await page.keyboard.press('Enter')
    await expect(steps.getByRole('textbox', { name: 'Step 2' })).toBeFocused()
    await page.keyboard.type('Cut the kernels off and toss with lime and cotija.')

    const tags = form.getByRole('combobox', { name: 'Tags' })
    await tags.fill('summer')
    // "Add “summer”" for a new tag, or just "summer" once an earlier run has saved it.
    await expect(page.getByRole('option', { name: /^(Add “summer”|summer)$/ }).first()).toBeVisible()
    await tags.press('Enter')
    await tags.fill('side')
    await tags.press(',')
    // While the suggestions popup is open, the chips are hidden from assistive tech; Tab closes it.
    await tags.press('Tab')
    await expect(form.getByRole('button', { name: 'Remove summer' })).toBeVisible()
    await expect(form.getByRole('button', { name: 'Remove side' })).toBeVisible()

    await form.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL(/\/recipe\/[\w-]+$/)
    const recipePath = new URL(page.url()).pathname
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    const saved = page.getByRole('region', { name: 'Ingredients' }).getByRole('checkbox')
    await expect(saved).toHaveCount(3)
    await expect(saved.nth(1)).toHaveAccessibleName('1 lime, juiced')
    await expect(page.getByRole('region', { name: 'Steps' }).getByRole('listitem')).toHaveCount(2)
    const chips = page.getByRole('group', { name: 'Tags and collections' })
    await expect(chips.getByRole('link', { name: 'summer' })).toBeVisible()
    await expect(chips.getByRole('link', { name: 'side' })).toBeVisible()

    // Edit: rename and add an ingredient.
    await page.getByRole('button', { name: 'More options' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    await expect(page).toHaveURL(`${recipePath}/edit`)
    const editor = page.getByRole('form').filter({ has: page.getByRole('textbox', { name: 'Title' }) })
    await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue(title)

    // Closing without changes needs no confirmation.
    await editor.getByRole('button', { name: 'Close' }).click()
    await expect(page).toHaveURL(recipePath)

    await page.getByRole('button', { name: 'More options' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue(title)
    await editor.getByRole('textbox', { name: 'Title' }).fill(`${title} with Chili`)

    await editor.getByRole('button', { name: 'Close' }).click()
    const guard = page.getByRole('alertdialog', { name: 'Discard changes?' })
    await expect(guard).toBeVisible()
    await guard.getByRole('button', { name: 'Keep editing' }).click()
    await expect(guard).toBeHidden()
    await expect(page).toHaveURL(`${recipePath}/edit`)
    await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue(`${title} with Chili`)

    await editor.getByRole('button', { name: 'Close' }).click()
    await guard.getByRole('button', { name: 'Discard' }).click()
    await expect(page).toHaveURL(recipePath)
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'More options' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    await editor.getByRole('textbox', { name: 'Title' }).fill(`${title} with Chili`)
    const editIngredients = editor.getByRole('region', { name: 'Ingredients' })
    await editIngredients.getByRole('textbox', { name: 'Ingredient 3' }).press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('1 teaspoon chili powder')
    await editor.getByRole('button', { name: 'Save' }).click()

    await expect(page).toHaveURL(recipePath)
    await expect(page.getByRole('heading', { level: 1, name: `${title} with Chili` })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Ingredients' }).getByRole('checkbox')).toHaveCount(4)
    await expect(
        page.getByRole('region', { name: 'Ingredients' }).getByRole('checkbox', { name: '1 teaspoon chili powder' }),
    ).toBeVisible()
})
