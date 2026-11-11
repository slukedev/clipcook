'use client'

import { type ReactNode, Suspense, use, useDeferredValue, useState } from 'react'
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { AssistChip, ChipSet, FilterChip } from '@/components/ui/chip'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { LoadingIndicator } from '@/components/ui/loading-indicator'
import { Ripple } from '@/components/ui/ripple'
import { SearchBar } from '@/components/ui/search'
import type { ActionResult, MealSlot, PlanEntry, RecipeSummary } from '@/lib/domain/types'
import { MEAL_LABELS, MEAL_SLOTS } from '@/lib/plan/entries'
import { suggestionGroups } from '@/lib/plan/suggest'
import { relativeDayName, weekdayShort } from '@/lib/plan/week'
import { matches, queryTokens, type SearchableRecipe, searchable } from '../../_library/library-data'
import { RecipeMedia } from '../../_library/recipe-media'
import { useCompactWindow } from '../../recipe/[id]/_view/adaptive-sheet'
import styles from './add-sheet.module.scss'
import type { PlanIcons } from './icons'
import { recipeTime } from './plan-entry'

export interface AddTarget {
    key: number
    date: string
    meal: MealSlot
}

const QUICK_NOTES = ['Leftovers', 'Eat out']
/** Below this many recipes the groups would only repeat the whole list. */
const GROUPS_FROM = 6
const MAX_RESULTS = 60

interface AddSheetProps {
    target: AddTarget | null
    onClose: () => void
    today: string
    library: Promise<ActionResult<RecipeSummary[]>> | null
    entries: PlanEntry[]
    icons: PlanIcons
    onAddRecipe: (recipe: RecipeSummary, date: string, meal: MealSlot) => string
    onAddNote: (note: string, date: string, meal: MealSlot) => string
    onUndo: (entryId: string) => void
}

/**
 * Adds meals to a day: a bottom sheet on phones, a dialog on wider windows. It stays
 * open, so a planner can add dish after dish; tapping an added dish takes it back off.
 */
export function AddSheet({ target, onClose, ...rest }: AddSheetProps) {
    const compact = useCompactWindow()
    // Keeps the last target while the sheet animates out.
    const [shown, setShown] = useState(target)
    if (target && target !== shown) setShown(target)
    const open = target !== null
    const title = shown ? `Add to ${relativeDayName(shown.date, rest.today)}` : 'Add'
    const content = shown && <Picker key={shown.key} target={shown} onClose={onClose} {...rest} />
    const done = (
        <Button variant="text" onClick={onClose}>
            Done
        </Button>
    )

    if (compact) {
        return (
            <BottomSheet open={open} onOpenChange={(next) => !next && onClose()}>
                <BottomSheetContent title={title} className={styles.sheet}>
                    {content}
                    <div className={styles.sheetActions}>{done}</div>
                </BottomSheetContent>
            </BottomSheet>
        )
    }
    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent headline={title} className={styles.dialog} actions={done}>
                {content}
            </DialogContent>
        </Dialog>
    )
}

type PickerProps = Omit<AddSheetProps, 'target' | 'onClose'> & { target: AddTarget; onClose: () => void }

function Picker({ target, library, entries, today, icons, onAddRecipe, onAddNote, onUndo }: PickerProps) {
    const [meal, setMeal] = useState<MealSlot>(target.meal)
    const [query, setQuery] = useState('')
    // What this sheet added, by recipe id or note text, so a second tap takes it back.
    const [added, setAdded] = useState<ReadonlyMap<string, string>>(new Map())

    const toggle = (key: string, add: () => string) => {
        const existing = added.get(key)
        const next = new Map(added)
        if (existing) {
            onUndo(existing)
            next.delete(key)
        } else {
            next.set(key, add())
        }
        setAdded(next)
    }

    const pickRecipe = (recipe: RecipeSummary) => toggle(recipe.id, () => onAddRecipe(recipe, target.date, meal))
    const pickNote = (note: string) => {
        const clean = note.replace(/\s+/g, ' ').trim()
        if (!clean) return
        toggle(`note:${clean.toLowerCase()}`, () => onAddNote(clean, target.date, meal))
    }

    // Where each recipe already sits this week, so doubles are a choice rather than a surprise.
    const plannedOn = new Map<string, string[]>()
    for (const e of entries) {
        if (!e.recipeId) continue
        const label = e.date === today ? 'today' : weekdayShort(e.date)
        plannedOn.set(e.recipeId, [...(plannedOn.get(e.recipeId) ?? []), label])
    }

    return (
        <div className={styles.picker}>
            <ChipSet scroll label="Meal" className={styles.meals}>
                {MEAL_SLOTS.map((slot) => (
                    <FilterChip key={slot} selected={meal === slot} onSelectedChange={() => setMeal(slot)}>
                        {MEAL_LABELS[slot]}
                    </FilterChip>
                ))}
            </ChipSet>
            <div className={styles.search}>
                <SearchBar
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Search or add a note"
                    leading={icons.search}
                    onSubmit={() => {
                        // Enter takes the top match, or keeps the text as a note.
                        document.querySelector<HTMLButtonElement>('[data-plan-pick]')?.click()
                    }}
                />
            </div>
            {!query.trim() && (
                <ChipSet label="Without a recipe" className={styles.notes}>
                    {QUICK_NOTES.map((note) => (
                        <AssistChip
                            key={note}
                            icon={note === 'Eat out' ? icons.eatOut : icons.note}
                            aria-pressed={added.has(`note:${note.toLowerCase()}`)}
                            data-added={added.has(`note:${note.toLowerCase()}`) || undefined}
                            onClick={() => pickNote(note)}
                        >
                            {note}
                        </AssistChip>
                    ))}
                </ChipSet>
            )}
            <Suspense
                fallback={
                    <div className={styles.loading}>
                        <LoadingIndicator label="Loading recipes" />
                    </div>
                }
            >
                {library && (
                    <Results
                        library={library}
                        meal={meal}
                        query={query}
                        added={added}
                        plannedOn={plannedOn}
                        icons={icons}
                        onPickRecipe={pickRecipe}
                        onPickNote={pickNote}
                    />
                )}
            </Suspense>
        </div>
    )
}

function Results({
    library,
    meal,
    query,
    added,
    plannedOn,
    icons,
    onPickRecipe,
    onPickNote,
}: {
    library: Promise<ActionResult<RecipeSummary[]>>
    meal: MealSlot
    query: string
    added: ReadonlyMap<string, string>
    plannedOn: ReadonlyMap<string, string[]>
    icons: PlanIcons
    onPickRecipe: (recipe: RecipeSummary) => void
    onPickNote: (note: string) => void
}) {
    const result = use(library)
    const deferred = useDeferredValue(query)
    const tokens = queryTokens(deferred)
    const [now] = useState(() => Date.now())
    if (!result.ok) return <p className={styles.none}>{result.error}</p>

    const all = searchable(result.data).toSorted((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }))
    const row = (recipe: SearchableRecipe, first = false) => (
        <RecipeRow
            key={recipe.id}
            recipe={recipe}
            added={added.has(recipe.id)}
            plannedOn={plannedOn.get(recipe.id)}
            icons={icons}
            first={first}
            onPick={() => onPickRecipe(recipe)}
        />
    )

    if (tokens.length > 0) {
        const found = all.filter((r) => matches(r, tokens)).slice(0, MAX_RESULTS)
        const note = deferred.replace(/\s+/g, ' ').trim()
        const noteKey = `note:${note.toLowerCase()}`
        return (
            <ul className={styles.list} aria-label="Results">
                {found.map((recipe, i) => row(recipe, i === 0))}
                <li>
                    <PickRow
                        icon={icons.note}
                        title={`Add “${note}” as a note`}
                        added={added.has(noteKey)}
                        icons={icons}
                        first={found.length === 0}
                        onPick={() => onPickNote(note)}
                    />
                </li>
            </ul>
        )
    }

    const groups = all.length >= GROUPS_FROM ? suggestionGroups(all, now, meal) : []
    const grouped = new Set(groups.flatMap((g) => g.recipes.map((r) => r.id)))
    const rest = all.filter((r) => !grouped.has(r.id))
    return (
        <div className={styles.groups}>
            {groups.map((group) => (
                <section key={group.key} aria-labelledby={`plan-group-${group.key}`}>
                    <h3 id={`plan-group-${group.key}`} className={styles.groupTitle}>
                        {group.title}
                    </h3>
                    <ul className={styles.list}>{group.recipes.map((r) => row(r))}</ul>
                </section>
            ))}
            {rest.length > 0 && (
                <section aria-labelledby="plan-group-all">
                    <h3 id="plan-group-all" className={groups.length > 0 ? styles.groupTitle : styles.srOnly}>
                        {groups.length > 0 ? 'More Recipes' : 'Recipes'}
                    </h3>
                    <ul className={styles.list}>{rest.map((r) => row(r))}</ul>
                </section>
            )}
        </div>
    )
}

function RecipeRow({
    recipe,
    added,
    plannedOn,
    icons,
    first,
    onPick,
}: {
    recipe: RecipeSummary
    added: boolean
    plannedOn: string[] | undefined
    icons: PlanIcons
    first: boolean
    onPick: () => void
}) {
    const meta = [recipeTime(recipe), plannedOn?.length ? `Planned ${plannedOn.join(', ')}` : ''].filter(Boolean)
    return (
        <li className={styles.item}>
            <PickRow
                thumb={<RecipeMedia src={recipe.thumbnail} title={recipe.title} sizes="48px" />}
                title={recipe.title}
                meta={meta.join(' · ')}
                added={added}
                icons={icons}
                first={first}
                onPick={onPick}
            />
        </li>
    )
}

function PickRow({
    thumb,
    icon,
    title,
    meta,
    added,
    icons,
    first,
    onPick,
}: {
    thumb?: ReactNode
    icon?: ReactNode
    title: string
    meta?: string
    added: boolean
    icons: PlanIcons
    first: boolean
    onPick: () => void
}) {
    return (
        <button
            type="button"
            className={styles.row}
            aria-pressed={added}
            data-plan-pick={first || undefined}
            onClick={onPick}
        >
            <Ripple />
            <span className={styles.thumb} data-icon={icon ? '' : undefined}>
                {thumb ?? icon}
            </span>
            <span className={styles.text}>
                <span className={styles.title}>{title}</span>
                {meta && <span className={styles.meta}>{meta}</span>}
            </span>
            <span className={styles.state} data-added={added || undefined} aria-hidden>
                {added ? icons.check : icons.add}
            </span>
        </button>
    )
}
