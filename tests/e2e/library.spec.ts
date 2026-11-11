import { expect, test } from './support/fixtures'
import { cardTitles, type ExportedRecipe, exportLibrary, recipeGrid, sorted } from './support/library'

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// Search covers ingredients too ("chicken" finds a chili made with chicken stock).
function searchHit(recipe: ExportedRecipe, query: string): boolean {
    const haystack = fold([recipe.title, recipe.sourceName ?? '', ...recipe.tags, ...recipe.ingredients].join('\n'))
    return fold(query)
        .split(/\s+/)
        .every((token) => haystack.includes(token))
}

test('search narrows the cards to matching recipes and survives a reload', async ({ page }) => {
    const { recipes } = await exportLibrary(page)
    const expected = sorted(recipes.filter((r) => searchHit(r, 'chicken')).map((r) => r.title))
    expect(expected.length).toBeGreaterThan(1)
    expect(expected.length).toBeLessThan(recipes.length)

    await page.goto('/')
    await page.getByRole('searchbox', { name: 'Search recipes' }).fill('chicken')
    await expect(page.getByText(`${expected.length} recipes`, { exact: true })).toBeVisible()
    expect(sorted(await cardTitles(page))).toEqual(expected)
    await expect(page).toHaveURL(/[?&]q=chicken/)

    await page.reload()
    await expect(page.getByRole('searchbox', { name: 'Search recipes' })).toHaveValue('chicken')
    expect(sorted(await cardTitles(page))).toEqual(expected)

    await page.getByRole('searchbox', { name: 'Search recipes' }).fill('zzz no such dish')
    await expect(page.getByRole('heading', { name: 'No Matches' })).toBeVisible()
    await page.getByRole('button', { name: /^Clear (search|filters)$/ }).click()
    await expect(recipeGrid(page).getByRole('listitem')).toHaveCount(recipes.length)
})

test('the favorites filter shows exactly the favorite recipes', async ({ page }) => {
    const { recipes } = await exportLibrary(page)
    const favorites = sorted(recipes.filter((r) => r.favorite).map((r) => r.title))
    expect(favorites.length).toBeGreaterThan(0)

    await page.goto('/')
    const chip = page.getByRole('group', { name: 'Filter recipes' }).getByRole('button', { name: 'Favorites' })
    await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
    await expect(recipeGrid(page).getByRole('listitem')).toHaveCount(favorites.length)
    expect(sorted(await cardTitles(page))).toEqual(favorites)
    for (const button of await recipeGrid(page).getByRole('button', { name: 'Favorite', exact: true }).all()) {
        await expect(button).toHaveAttribute('aria-pressed', 'true')
    }
    await expect(page).toHaveURL(/[?&]f=fav/)
})

test('a tag in the URL filters the library and shows on the Tags chip', async ({ page }) => {
    const { recipes } = await exportLibrary(page)
    const tagged = sorted(recipes.filter((r) => r.tags.includes('dessert')).map((r) => r.title))
    expect(tagged.length).toBeGreaterThan(1)

    await page.goto('/?tag=dessert')
    await expect(page.getByRole('button', { name: 'Tags: dessert' })).toHaveAttribute('aria-pressed', 'true')
    await expect(recipeGrid(page).getByRole('listitem')).toHaveCount(tagged.length)
    expect(sorted(await cardTitles(page))).toEqual(tagged)

    await page.getByRole('button', { name: 'Tags: dessert' }).click()
    await page.getByRole('menuitem', { name: 'Clear tags' }).click()
    await expect(recipeGrid(page).getByRole('listitem')).toHaveCount(recipes.length)
    await expect(page).not.toHaveURL(/tag=/)
})

test('sorting A to Z orders the cards and is remembered', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /^Sort: / }).click()
    await page.getByRole('menuitemradio', { name: 'A to Z' }).click()
    await expect(page.getByRole('button', { name: 'Sort: A to Z' })).toBeVisible()

    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
    const titles = await cardTitles(page)
    expect(titles).toEqual(titles.toSorted(collator.compare))

    await page.reload()
    await expect(page.getByRole('button', { name: 'Sort: A to Z' })).toBeVisible()
    expect(await cardTitles(page)).toEqual(titles)

    await page.getByRole('button', { name: 'Sort: A to Z' }).click()
    await page.getByRole('menuitemradio', { name: 'Recent', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Sort: Recent' })).toBeVisible()
    expect(await cardTitles(page)).not.toEqual(titles)
})

test('deleting a recipe can be undone, and the undo sticks', async ({ page }) => {
    const title = 'Roasted Tomato Soup with Garlic Croutons'
    await page.goto('/')
    const card = recipeGrid(page)
        .getByRole('listitem')
        .filter({ has: page.getByRole('link', { name: title }) })
    await expect(card).toHaveCount(1)
    const before = await recipeGrid(page).getByRole('listitem').count()

    await card.getByRole('button', { name: `More for ${title}` }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(card).toHaveCount(0)
    await expect(recipeGrid(page).getByRole('listitem')).toHaveCount(before - 1)

    await page.getByRole('region', { name: 'Notifications' }).getByRole('button', { name: 'Undo' }).click()
    await expect(card).toHaveCount(1)
    await expect(recipeGrid(page).getByRole('listitem')).toHaveCount(before)

    // Leaving the page flushes pending deletes, so a broken undo would lose the recipe here.
    await page.reload()
    await expect(card).toHaveCount(1)
    const { recipes } = await exportLibrary(page)
    expect(recipes.filter((r) => r.title === title)).toHaveLength(1)
})

test('a card menu goes straight into cook mode', async ({ page }) => {
    const title = 'Big Green Salad with Feta and Lemon'
    await page.goto('/')
    const card = recipeGrid(page)
        .getByRole('listitem')
        .filter({ has: page.getByRole('link', { name: title }) })
    await card.getByRole('button', { name: `More for ${title}` }).click()
    await page.getByRole('menuitem', { name: 'Cook' }).click()
    await expect(page).toHaveURL(/\/recipe\/[^/]+\/cook$/)
    await expect(page.getByRole('heading', { name: 'Before You Start' })).toBeVisible()
})
