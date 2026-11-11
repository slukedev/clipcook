import { Icon } from '@/components/ui/icon'
import { getPlanClock } from '@/server/plan-clock'
import { WeekStartRow } from './week-start'

/** Meal plan settings. The week start defaults to the custom of the cook's region. */
export async function PlanSection() {
    const { weekStart } = await getPlanClock()
    return <WeekStartRow initial={weekStart} icon={<Icon name="date_range" />} />
}
