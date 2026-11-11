'use client'

import { type ReactNode, type Ref, useSyncExternalStore } from 'react'
import styles from './cook-mode.module.scss'

const MINUTE = 60_000

/** The current minute, ticking on the minute; null on the server so the HTML never guesses a clock. */
function useMinute(): number | null {
    return useSyncExternalStore(
        (onChange) => {
            let timer = 0
            const schedule = () => {
                timer = window.setTimeout(
                    () => {
                        onChange()
                        schedule()
                    },
                    MINUTE - (Date.now() % MINUTE) + 50,
                )
            }
            schedule()
            return () => window.clearTimeout(timer)
        },
        () => Math.floor(Date.now() / MINUTE),
        () => null,
    )
}

const sameDay = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const otherDay = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })

function readyLabel(minute: number, totalMinutes: number): string {
    const now = new Date(minute * MINUTE)
    const done = new Date((minute + Math.round(totalMinutes)) * MINUTE)
    const format = done.toDateString() === now.toDateString() ? sameDay : otherDay
    return `Ready around ${format.format(done)}`
}

/**
 * What to know before step 1: how long it takes and when it will be done, the pans and
 * tools to get out, and (on compact windows, where the side pane is a sheet) the
 * ingredients to gather. Checking an ingredient here carries into the steps.
 */
export function PrepOverview({
    totalMinutes,
    totalTime,
    equipment,
    ingredients,
    enter,
    ref,
    icons,
    ingredientsId,
}: {
    totalMinutes: number | null
    totalTime: string
    equipment: string[]
    ingredients: ReactNode
    enter: string
    ref?: Ref<HTMLDivElement>
    icons: { timer: ReactNode; schedule: ReactNode }
    /** Lets the hands-free "ingredients" command move focus to the list. */
    ingredientsId?: string
}) {
    const minute = useMinute()
    return (
        <div ref={ref} className={styles.prep} data-enter={enter}>
            <h2 className={styles.prepTitle}>Before You Start</h2>
            <ul className={styles.facts}>
                {totalTime && (
                    <li className={styles.fact}>
                        {icons.timer}
                        {totalTime}
                    </li>
                )}
                {minute !== null && totalMinutes ? (
                    <li className={styles.fact}>
                        {icons.schedule}
                        {readyLabel(minute, totalMinutes)}
                    </li>
                ) : null}
            </ul>
            {equipment.length > 0 && (
                <section className={styles.prepSection} aria-labelledby="cook-equipment">
                    <h3 id="cook-equipment" className={styles.prepHeading}>
                        Equipment
                    </h3>
                    <ul className={styles.tools}>
                        {equipment.map((tool) => (
                            <li key={tool} className={styles.tool}>
                                {tool}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            {ingredients && (
                <section
                    id={ingredientsId}
                    className={styles.prepIngredients}
                    aria-labelledby="cook-gather"
                    tabIndex={-1}
                >
                    <h3 id="cook-gather" className={styles.prepHeading}>
                        Ingredients
                    </h3>
                    {ingredients}
                </section>
            )}
        </div>
    )
}
