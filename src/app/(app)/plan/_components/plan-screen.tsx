'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { listPickerRecipes } from '@/actions/collections'
import {
    addPlanNote,
    addPlanRecipe,
    addPlanWeekToGrocery,
    clearPlanWeek,
    copyPreviousWeek,
    movePlanEntry,
    removePlanEntry,
    restorePlanEntries,
    setPlanServings,
} from '@/actions/plan'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogClose, AlertDialogContent } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { useSnackbar } from '@/components/ui/snackbar'
import { Tooltip } from '@/components/ui/tooltip'
import { TopAppBar } from '@/components/ui/top-app-bar'
import type { ActionResult, MealSlot, PlanEntry, RecipeSummary } from '@/lib/domain/types'
import { entriesToShop, MEAL_LABELS, plannedRecipeIds, suggestedMeal } from '@/lib/plan/entries'
import { addDays, formatWeekRange, relativeDayName, shortDate, weekDates, weekdayName } from '@/lib/plan/week'
import { AddSheet, type AddTarget } from './add-sheet'
import type { PlanIcons } from './icons'
import styles from './plan.module.scss'
import { ServingsDialog } from './servings-dialog'
import { TonightCard } from './tonight-card'
import { newEntryId, usePlanEntries } from './use-plan'
import { WeekGrid } from './week-grid'

export interface PlanScreenProps {
    weekStart: string
    today: string
    hour: number
    entries: PlanEntry[]
    recipes: Record<string, RecipeSummary>
    suggestions: string[]
    recipeCount: number
    previousWeekCount: number
    icons: PlanIcons
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function isTyping(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null
    return Boolean(el?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]'))
}

export function PlanScreen({
    weekStart,
    today,
    hour,
    entries: serverEntries,
    recipes: serverRecipes,
    suggestions,
    recipeCount,
    previousWeekCount,
    icons,
}: PlanScreenProps) {
    const router = useRouter()
    const snackbar = useSnackbar()
    const { entries, run } = usePlanEntries(serverEntries)
    // Recipes picked in the sheet join the ones the server sent, so new rows have photos.
    const [picked, setPicked] = useState<Record<string, RecipeSummary>>({})
    const recipes = { ...serverRecipes, ...picked }

    const [target, setTarget] = useState<AddTarget | null>(null)
    const library = useRef<Promise<ActionResult<RecipeSummary[]>> | null>(null)
    const [servingsFor, setServingsFor] = useState<PlanEntry | null>(null)
    const [confirmAgain, setConfirmAgain] = useState(false)
    const [announcement, setAnnouncement] = useState('')

    const days = weekDates(weekStart)
    const end = days[6] ?? weekStart
    const current = today >= weekStart && today <= end
    const visible = entries.filter((e) => e.date >= weekStart && e.date <= end)
    // Mid-week, the days already over are cooked; shopping starts today.
    const shopFrom = current ? today : weekStart
    const upcoming = visible.filter((e) => e.date >= shopFrom)
    const toShop = entriesToShop(upcoming)
    const shopRecipes = plannedRecipeIds(toShop).length
    const weekRecipes = plannedRecipeIds(upcoming).length
    const shopLabel = shopRecipes > 0 ? `Add ${plural(shopRecipes, 'recipe')} to list` : 'Add to grocery list'
    const previousWeek = addDays(weekStart, -7)
    const nextWeek = addDays(weekStart, 7)
    const title = formatWeekRange(weekStart, today)

    const say = (text: string) => setAnnouncement(text)

    // n and p (or j and k) page through weeks and t returns to this one, as in Google Calendar.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
            const key = event.key.toLowerCase()
            const href =
                key === 'n' || key === 'j'
                    ? `/plan?week=${nextWeek}`
                    : key === 'p' || key === 'k'
                      ? `/plan?week=${previousWeek}`
                      : key === 't' && !current
                        ? '/plan'
                        : null
            if (!href) return
            event.preventDefault()
            router.push(href)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [router, nextWeek, previousWeek, current])

    function openAdd(date: string, meal?: MealSlot) {
        library.current ??= listPickerRecipes()
        setTarget({ key: Date.now(), date, meal: meal ?? suggestedMeal(entries, date) })
    }

    function addRecipe(recipe: RecipeSummary, date: string, meal: MealSlot): string {
        const entry: PlanEntry = {
            id: newEntryId(),
            date,
            meal,
            recipeId: recipe.id,
            note: '',
            servings: null,
            groceryAddedAt: null,
            createdAt: Date.now(),
        }
        setPicked((current) => (current[recipe.id] ? current : { ...current, [recipe.id]: recipe }))
        run(
            { type: 'add', entries: [entry] },
            () => addPlanRecipe({ id: entry.id, date, meal, recipeId: recipe.id }),
            (saved) => ({ type: 'add', entries: [saved] }),
        )
        say(`Added ${recipe.title} to ${weekdayName(date)}`)
        return entry.id
    }

    function addNote(note: string, date: string, meal: MealSlot): string {
        const entry: PlanEntry = {
            id: newEntryId(),
            date,
            meal,
            recipeId: null,
            note,
            servings: null,
            groceryAddedAt: null,
            createdAt: Date.now(),
        }
        run(
            { type: 'add', entries: [entry] },
            () => addPlanNote({ id: entry.id, date, meal, note }),
            (saved) => ({ type: 'add', entries: [saved] }),
        )
        say(`Added ${note} to ${weekdayName(date)}`)
        return entry.id
    }

    function restore(removed: PlanEntry[]) {
        if (removed.length === 0) return
        run(
            { type: 'add', entries: removed },
            () => restorePlanEntries(removed),
            (saved) => ({ type: 'add', entries: saved }),
        )
    }

    function remove(entry: PlanEntry, quiet = false) {
        run(
            { type: 'remove', ids: [entry.id] },
            () => removePlanEntry(entry.id),
            undefined,
            (removed) => {
                if (quiet) return
                snackbar({ message: 'Removed from plan', action: 'Undo', onAction: () => restore([removed]) })
            },
        )
        say(`Removed ${labelOf(entry)}`)
    }

    function labelOf(entry: PlanEntry): string {
        return entry.recipeId ? (recipes[entry.recipeId]?.title ?? 'Recipe') : entry.note
    }

    function move(entry: PlanEntry, to: { date?: string; meal?: MealSlot }) {
        const date = to.date ?? entry.date
        const meal = to.meal ?? entry.meal
        if (date === entry.date && meal === entry.meal) return
        run({ type: 'update', id: entry.id, patch: { date, meal } }, () => movePlanEntry(entry.id, { date, meal }))
        const leaves = date < weekStart || date > end
        if (leaves) {
            snackbar({
                message: `Moved to ${shortDate(date)}`,
                action: 'Show',
                onAction: () => router.push(`/plan?week=${date}`),
            })
        }
        say(
            date !== entry.date
                ? `Moved ${labelOf(entry)} to ${relativeDayName(date, today)}`
                : `Moved ${labelOf(entry)} to ${MEAL_LABELS[meal].toLowerCase()}`,
        )
    }

    function setServings(entry: PlanEntry, servings: number | null) {
        setServingsFor(null)
        if (servings === entry.servings) return
        run(
            { type: 'update', id: entry.id, patch: { servings, groceryAddedAt: null } },
            () => setPlanServings(entry.id, servings),
            (saved) => ({ type: 'update', id: saved.id, patch: saved }),
        )
    }

    function shop(again = false) {
        setConfirmAgain(false)
        if (!again && toShop.length === 0) {
            setConfirmAgain(true)
            return
        }
        const ids = (again ? upcoming.filter((e) => e.recipeId) : toShop).map((e) => e.id)
        run(
            { type: 'mark', ids, groceryAddedAt: Date.now() },
            () => addPlanWeekToGrocery(weekStart, { again, from: shopFrom }),
            (result) => ({ type: 'mark', ids: result.entryIds, groceryAddedAt: result.groceryAddedAt }),
            (result) => {
                if (result.recipes === 0) {
                    snackbar('Nothing to add')
                    return
                }
                snackbar({
                    message: `Added ${plural(result.recipes, 'recipe')} to the list`,
                    action: 'View list',
                    onAction: () => router.push('/grocery'),
                })
            },
        )
        say(`Adding ${plural(ids.length, 'meal')} to the grocery list`)
    }

    function clearWeek() {
        const ids = visible.map((e) => e.id)
        if (ids.length === 0) return
        run(
            { type: 'remove', ids },
            () => clearPlanWeek(weekStart),
            undefined,
            (removed) =>
                snackbar({
                    message: 'Week cleared',
                    action: 'Undo',
                    onAction: () => restore(removed),
                }),
        )
        say('Week cleared')
    }

    function copyLastWeek() {
        run(
            null,
            () => copyPreviousWeek(weekStart),
            (added) => ({ type: 'add', entries: added }),
            (added) => {
                if (added.length === 0) {
                    snackbar('Last week is already here')
                    return
                }
                snackbar({
                    message: `Copied ${plural(added.length, 'meal')}`,
                    action: 'Undo',
                    onAction: () => {
                        run({ type: 'remove', ids: added.map((e) => e.id) }, async () => {
                            const results = await Promise.all(added.map((e) => removePlanEntry(e.id)))
                            return results.find((r) => !r.ok) ?? { ok: true as const, data: null }
                        })
                    },
                })
            },
        )
    }

    if (recipeCount === 0 && visible.length === 0) {
        return (
            <div className={styles.page}>
                <h1 className={styles.srOnly}>{title}</h1>
                <EmptyState
                    className={styles.empty}
                    shape="cookie9"
                    icon={icons.calendar}
                    title="No Recipes Yet"
                    titleAs="h2"
                    action={
                        <Button
                            size="m"
                            icon={icons.link}
                            render={<Link href="/clip?mode=link" />}
                            nativeButton={false}
                        >
                            Clip a recipe
                        </Button>
                    }
                />
            </div>
        )
    }

    const weekMenu = (
        <Menu>
            <MenuTrigger render={<IconButton label="Week options" icon={icons.more} />} />
            <MenuContent align="end">
                <MenuItem
                    className={styles.compactOnly}
                    icon={icons.cart}
                    disabled={weekRecipes === 0}
                    onClick={() => shop()}
                >
                    {shopLabel}
                </MenuItem>
                <MenuItem icon={icons.copy} disabled={previousWeekCount === 0} onClick={copyLastWeek}>
                    Copy last week
                </MenuItem>
                <MenuSeparator />
                <MenuItem icon={icons.clear} disabled={visible.length === 0} onClick={clearWeek}>
                    Clear week
                </MenuItem>
            </MenuContent>
        </Menu>
    )

    return (
        <div className={styles.page}>
            <TopAppBar
                variant="medium"
                title={title}
                trailing={
                    <>
                        {!current && (
                            <Button
                                variant="text"
                                className={styles.thisWeek}
                                render={<Link href="/plan" prefetch />}
                                nativeButton={false}
                                aria-keyshortcuts="t"
                            >
                                This week
                            </Button>
                        )}
                        <Tooltip content="Previous week">
                            <IconButton
                                label="Previous week"
                                icon={icons.previous}
                                render={<Link href={`/plan?week=${previousWeek}`} prefetch />}
                                nativeButton={false}
                                aria-keyshortcuts="p"
                            />
                        </Tooltip>
                        <Tooltip content="Next week">
                            <IconButton
                                label="Next week"
                                icon={icons.next}
                                render={<Link href={`/plan?week=${nextWeek}`} prefetch />}
                                nativeButton={false}
                                aria-keyshortcuts="n"
                            />
                        </Tooltip>
                        {weekRecipes > 0 && (
                            <Button
                                variant="tonal"
                                className={styles.shopButton}
                                icon={icons.cart}
                                onClick={() => shop()}
                            >
                                {shopLabel}
                            </Button>
                        )}
                        {weekMenu}
                    </>
                }
            />

            <div className={styles.body}>
                {current && (
                    <TonightCard
                        today={today}
                        hour={hour}
                        entries={visible.filter((e) => e.date === today)}
                        recipes={recipes}
                        suggestions={suggestions.flatMap((id) => (recipes[id] ? [recipes[id]] : []))}
                        icons={icons}
                        onAdd={(recipe) => addRecipe(recipe, today, 'dinner')}
                        onBrowse={() => openAdd(today, suggestedMeal(entries, today))}
                    />
                )}

                <WeekGrid
                    days={days}
                    today={today}
                    entries={visible}
                    recipes={recipes}
                    icons={icons}
                    onAdd={openAdd}
                    onMove={move}
                    onRemove={(entry) => remove(entry)}
                    onServings={setServingsFor}
                />
            </div>

            <AddSheet
                target={target}
                onClose={() => setTarget(null)}
                today={today}
                library={library.current}
                entries={visible}
                icons={icons}
                onAddRecipe={addRecipe}
                onAddNote={addNote}
                onUndo={(id) => {
                    const entry = entries.find((e) => e.id === id)
                    if (entry) remove(entry, true)
                }}
            />

            <ServingsDialog
                entry={servingsFor}
                recipe={servingsFor?.recipeId ? recipes[servingsFor.recipeId] : undefined}
                onClose={() => setServingsFor(null)}
                onSave={setServings}
            />

            <AlertDialog open={confirmAgain} onOpenChange={setConfirmAgain}>
                <AlertDialogContent
                    headline="Add Again?"
                    actions={
                        <>
                            <AlertDialogClose render={<Button variant="text" />}>Cancel</AlertDialogClose>
                            <Button variant="text" onClick={() => shop(true)}>
                                Add again
                            </Button>
                        </>
                    }
                >
                    This week's recipes are already on your grocery list.
                </AlertDialogContent>
            </AlertDialog>

            <p className={styles.srOnly} role="status" aria-live="polite">
                {announcement}
            </p>
        </div>
    )
}
