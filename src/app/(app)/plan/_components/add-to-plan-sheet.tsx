'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { addPlanRecipe } from '@/actions/plan'
import { Button } from '@/components/ui/button'
import { ChipSet, FilterChip } from '@/components/ui/chip'
import { NumberStepper } from '@/components/ui/number-stepper'
import { useSnackbar } from '@/components/ui/snackbar'
import type { MealSlot } from '@/lib/domain/types'
import { LIMITS } from '@/lib/domain/types'
import { MEAL_LABELS, MEAL_SLOTS } from '@/lib/plan/entries'
import {
    addDays,
    dayOfMonth,
    defaultWeekStart,
    localToday,
    parseWeekStart,
    relativeDayName,
    shortDate,
    WEEK_START_COOKIE,
    weekdayShort,
    weekStartOf,
} from '@/lib/plan/week'
import { servingsNumber } from '@/lib/recipe/ingredients'
import { readCookie } from '../../_shell/preferences'
import { AdaptiveSheet } from '../../recipe/[id]/_view/adaptive-sheet'
import styles from './add-to-plan.module.scss'

/** Today through the end of next week, split where next week begins. */
export function planDays(today: string, weekStart: 'monday' | 'sunday'): { thisWeek: string[]; nextWeek: string[] } {
    const next = addDays(weekStartOf(today, weekStart), 7)
    const thisWeek: string[] = []
    for (let d = today; d < next; d = addDays(d, 1)) thisWeek.push(d)
    return { thisWeek, nextWeek: Array.from({ length: 7 }, (_, i) => addDays(next, i)) }
}

/** 'today', 'tomorrow', 'Friday', or 'Fri, Nov 20' once it is next week. */
function spokenDay(date: string, today: string, thisWeek: string[]): string {
    const name = relativeDayName(date, today)
    if (name === 'Today' || name === 'Tomorrow') return name.toLowerCase()
    return thisWeek.includes(date) ? name : `${weekdayShort(date)}, ${shortDate(date)}`
}

function browserWeekStart() {
    return parseWeekStart(readCookie(WEEK_START_COOKIE)) ?? defaultWeekStart(navigator.language)
}

/** "Add to plan" from a recipe: pick a day, a meal and how many to cook for. */
export function AddToPlanSheet({
    open,
    onOpenChange,
    recipe,
    scale,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    recipe: { id: string; title: string; servings: string }
    /** The servings scale the cook has set on the recipe page. */
    scale: number
}) {
    const router = useRouter()
    const snackbar = useSnackbar()
    const [pending, startTransition] = useTransition()
    const base = servingsNumber(recipe.servings)
    const [today] = useState(localToday)
    const [days] = useState(() => planDays(today, browserWeekStart()))
    const [date, setDate] = useState(today)
    const [meal, setMeal] = useState<MealSlot>('dinner')
    const [servings, setServings] = useState(() => (base === null ? null : Math.max(1, Math.round(base * scale))))

    const submit = () => {
        if (pending) return
        startTransition(async () => {
            const result = await addPlanRecipe({
                date,
                meal,
                recipeId: recipe.id,
                servings: servings === null || servings === base ? null : servings,
            })
            if (!result.ok) {
                snackbar({ message: result.error, urgent: true })
                return
            }
            onOpenChange(false)
            snackbar({
                message: `Planned for ${spokenDay(date, today, days.thisWeek)}`,
                action: 'View plan',
                onAction: () => router.push(`/plan?week=${date}`),
            })
        })
    }

    const dayChip = (d: string) => (
        <FilterChip key={d} selected={d === date} onSelectedChange={() => setDate(d)}>
            {d === today || d === addDays(today, 1) ? relativeDayName(d, today) : `${weekdayShort(d)} ${dayOfMonth(d)}`}
        </FilterChip>
    )

    return (
        <AdaptiveSheet
            open={open}
            onOpenChange={(next) => !pending && onOpenChange(next)}
            title="Add to Plan"
            actions={
                <>
                    <Button variant="text" onClick={() => onOpenChange(false)} disabled={pending}>
                        Cancel
                    </Button>
                    <Button onClick={submit} loading={pending}>
                        Add to plan
                    </Button>
                </>
            }
        >
            <div className={styles.body}>
                <section className={styles.group} aria-labelledby="add-to-plan-this-week">
                    <h3 id="add-to-plan-this-week" className={styles.label}>
                        This Week
                    </h3>
                    <ChipSet label="This week">{days.thisWeek.map(dayChip)}</ChipSet>
                </section>
                <section className={styles.group} aria-labelledby="add-to-plan-next-week">
                    <h3 id="add-to-plan-next-week" className={styles.label}>
                        Next Week
                    </h3>
                    <ChipSet label="Next week">{days.nextWeek.map(dayChip)}</ChipSet>
                </section>
                <section className={styles.group} aria-labelledby="add-to-plan-meal">
                    <h3 id="add-to-plan-meal" className={styles.label}>
                        Meal
                    </h3>
                    <ChipSet label="Meal">
                        {MEAL_SLOTS.map((slot) => (
                            <FilterChip key={slot} selected={meal === slot} onSelectedChange={() => setMeal(slot)}>
                                {MEAL_LABELS[slot]}
                            </FilterChip>
                        ))}
                    </ChipSet>
                </section>
                {servings !== null && (
                    <div className={styles.servings}>
                        <span className={styles.label} id="add-to-plan-servings">
                            Servings
                        </span>
                        <NumberStepper
                            label="Servings"
                            labelHidden
                            valueWidth={3}
                            value={servings}
                            min={1}
                            max={LIMITS.planServings}
                            step={1}
                            onValueChange={(value) => {
                                if (value !== null && value >= 1) setServings(Math.round(value))
                            }}
                        />
                    </div>
                )}
            </div>
        </AdaptiveSheet>
    )
}
