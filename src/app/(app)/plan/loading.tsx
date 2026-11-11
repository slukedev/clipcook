import type { CSSProperties } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { TopAppBar } from '@/components/ui/top-app-bar'
import { PageTransition } from '@/components/ui/view-transition'
import { MEAL_LABELS, MEAL_SLOTS } from '@/lib/plan/entries'
import styles from './_components/plan.module.scss'
import skeleton from './_components/skeleton.module.scss'

// Which days hold a meal in the placeholder week, so it reads as a week and not a grid.
const DAYS = [true, true, false, true, false, true, false]
// The same rows the week draws when only dinner is in use.
const ROWS = MEAL_SLOTS.map((slot) => (slot === 'dinner' ? 'var(--_open)' : 'var(--_slim)')).join(' ')
const DINNER_ROW = MEAL_SLOTS.indexOf('dinner') + 2

function PlanPlaceholder() {
    return (
        <div className={styles.page} aria-busy="true">
            <TopAppBar variant="medium" title={<Skeleton width={180} height={28} shape="small" />} titleAs="div" />
            <h1 className={styles.srOnly}>Meal plan</h1>
            <div className={styles.body}>
                <div className={skeleton.tonight}>
                    <Skeleton className={skeleton.photo} shape="large" />
                    <div className={skeleton.lines}>
                        <Skeleton width="80%" height={28} shape="small" />
                        <Skeleton width="45%" height={20} shape="small" />
                        <Skeleton width={104} height={56} shape="pill" />
                    </div>
                </div>
                <div
                    className={styles.week}
                    style={{ '--_lanes': MEAL_SLOTS.length, '--_rows': ROWS } as CSSProperties}
                >
                    {MEAL_SLOTS.map((slot, lane) => (
                        <p
                            key={slot}
                            className={styles.laneLabel}
                            style={{ gridColumn: 1, gridRow: lane + 2 }}
                            data-slim={slot === 'dinner' ? undefined : ''}
                            aria-hidden
                        >
                            {MEAL_LABELS[slot]}
                        </p>
                    ))}
                    {DAYS.map((filled, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed placeholder list
                        <div key={index} className={styles.day} style={{ gridColumn: index + 2 }}>
                            <div className={skeleton.header}>
                                <Skeleton width={96} height={20} shape="small" />
                            </div>
                            <div className={skeleton.cell} style={{ gridRow: DINNER_ROW }}>
                                {filled && <Skeleton className={skeleton.entry} shape="large" />}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

/** Enters with the navigation's motion and crossfades into the page when it arrives. */
export default function Loading() {
    return (
        <PageTransition>
            <PlanPlaceholder />
        </PageTransition>
    )
}
