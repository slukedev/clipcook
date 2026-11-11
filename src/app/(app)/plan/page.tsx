import type { Metadata } from 'next'
import { PageTransition } from '@/components/ui/view-transition'
import type { RecipeSummary } from '@/lib/domain/types'
import { entriesInWeek, plannedRecipeIds } from '@/lib/plan/entries'
import { tonightSuggestions } from '@/lib/plan/suggest'
import { addDays, weekFromParam } from '@/lib/plan/week'
import { requireSession } from '@/server/auth'
import { getPlanClock } from '@/server/plan-clock'
import { getPlanEntries, listRecipeCards } from '@/server/queries'
import { planIcons } from './_components/icons'
import { PlanScreen } from './_components/plan-screen'

export const metadata: Metadata = { title: 'Meal Plan' }

type Props = { searchParams: Promise<{ week?: string | string[] }> }

export default async function PlanPage({ searchParams }: Props) {
    const [{ uid }, params, clock] = await Promise.all([requireSession(), searchParams, getPlanClock()])
    const weekStart = weekFromParam(params.week, clock.today, clock.weekStart)
    const [plan, recipes] = await Promise.all([getPlanEntries(uid), listRecipeCards(uid)])

    const byId = new Map(recipes.map((r) => [r.id, r]))
    // Meals whose recipe is gone drop out; deleting a recipe removes them anyway.
    const week = entriesInWeek(plan, weekStart).filter((e) => e.recipeId === null || byId.has(e.recipeId))
    const previousWeek = entriesInWeek(plan, addDays(weekStart, -7)).length

    const planned = new Set(plannedRecipeIds(week))
    const suggestions = tonightSuggestions(recipes, Date.now(), planned).map((r) => r.id)
    // Only what this week shows; the picker loads the whole library when it opens.
    const shown: Record<string, RecipeSummary> = {}
    for (const id of [...planned, ...suggestions]) {
        const recipe = byId.get(id)
        if (recipe) shown[id] = recipe
    }

    return (
        <PageTransition>
            <PlanScreen
                // A new week is a new screen: no optimistic state carries over.
                key={weekStart}
                weekStart={weekStart}
                today={clock.today}
                hour={clock.hour}
                entries={week}
                recipes={shown}
                suggestions={suggestions}
                recipeCount={recipes.length}
                previousWeekCount={previousWeek}
                icons={planIcons()}
            />
        </PageTransition>
    )
}
