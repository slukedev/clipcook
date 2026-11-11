'use client'

import { type DragEvent, useRef, useState, useSyncExternalStore } from 'react'
import { IconButton } from '@/components/ui/icon-button'
import type { MealSlot, PlanEntry, RecipeSummary } from '@/lib/domain/types'
import { MEAL_LABELS, MEAL_SLOTS } from '@/lib/plan/entries'
import { dayOfMonth, longDate, relativeDayName, shortDate, weekdayName, weekdayShort } from '@/lib/plan/week'
import type { PlanIcons } from './icons'
import styles from './plan.module.scss'
import { PlanEntryItem } from './plan-entry'

const FINE_POINTER = '(pointer: fine)'

function subscribe(onChange: () => void) {
    const query = window.matchMedia(FINE_POINTER)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
}

/** Drag and drop is for mice and trackpads; touch and keyboard use the entry menu. */
function useFinePointer(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(FINE_POINTER).matches,
        () => false,
    )
}

const DRAG_TYPE = 'application/x-clipcook-plan-entry'

export interface WeekGridProps {
    days: string[]
    today: string
    entries: PlanEntry[]
    recipes: Record<string, RecipeSummary>
    icons: PlanIcons
    onAdd: (date: string, meal?: MealSlot) => void
    onMove: (entry: PlanEntry, to: { date?: string; meal?: MealSlot }) => void
    onRemove: (entry: PlanEntry) => void
    onServings: (entry: PlanEntry) => void
}

/**
 * The week. Compact windows stack the days; wider ones lay them out as columns with a
 * row per meal in use, like a calendar's hours, so the week's dinners line up.
 */
export function WeekGrid({ days, today, entries, recipes, icons, onAdd, onMove, onRemove, onServings }: WeekGridProps) {
    const draggable = useFinePointer()
    const [dragging, setDragging] = useState<string | null>(null)
    // Read by dragover, which can fire before the state above has rendered.
    const draggingRef = useRef<string | null>(null)
    const [over, setOver] = useState<string | null>(null)

    // Dinner always has a row; other meals get one as soon as the week uses them.
    const lanes = MEAL_SLOTS.filter((slot) => slot === 'dinner' || entries.some((e) => e.meal === slot))
    const multi = lanes.length > 1
    const offset = multi ? 2 : 1

    const dropProps = (key: string, date: string, meal?: MealSlot) =>
        draggable
            ? {
                  'data-drop': over === key || undefined,
                  onDragOver: (event: DragEvent) => {
                      if (!draggingRef.current && !event.dataTransfer.types.includes(DRAG_TYPE)) return
                      event.preventDefault()
                      event.stopPropagation()
                      event.dataTransfer.dropEffect = 'move'
                      if (over !== key) setOver(key)
                  },
                  onDragLeave: (event: DragEvent) => {
                      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                      if (over === key) setOver(null)
                  },
                  onDrop: (event: DragEvent) => {
                      event.preventDefault()
                      event.stopPropagation()
                      const id = event.dataTransfer.getData(DRAG_TYPE) || draggingRef.current
                      const entry = entries.find((e) => e.id === id)
                      draggingRef.current = null
                      setOver(null)
                      setDragging(null)
                      if (entry) onMove(entry, { date, meal: meal ?? entry.meal })
                  },
              }
            : {}

    return (
        <div
            className={styles.week}
            data-multi={multi || undefined}
            data-dragging={dragging ? '' : undefined}
            style={{ '--_lanes': lanes.length } as React.CSSProperties}
        >
            {multi &&
                lanes.map((slot, i) => (
                    <p key={slot} className={styles.laneLabel} style={{ gridColumn: 1, gridRow: i + 2 }} aria-hidden>
                        {MEAL_LABELS[slot]}
                    </p>
                ))}
            {days.map((date, index) => {
                const dayEntries = entries.filter((e) => e.date === date)
                const isToday = date === today
                const past = date < today
                const headingId = `plan-day-${date}`
                const name = relativeDayName(date, today)
                const longName = weekdayName(date)
                return (
                    <section
                        key={date}
                        className={styles.day}
                        style={{ gridColumn: index + offset }}
                        data-today={isToday || undefined}
                        data-past={past || undefined}
                        data-empty={dayEntries.length === 0 || undefined}
                        aria-labelledby={headingId}
                        {...dropProps(date, date)}
                    >
                        <header className={styles.dayHeader}>
                            <h2 id={headingId} className={styles.dayHeading}>
                                <span className={styles.srOnly}>
                                    {isToday ? `Today, ${longDate(date)}` : longDate(date)}
                                </span>
                                <span className={styles.dayName} aria-hidden>
                                    {name}
                                </span>
                                <span className={styles.dayDate} aria-hidden>
                                    {name === longName ? shortDate(date) : `${weekdayShort(date)}, ${shortDate(date)}`}
                                </span>
                                <span className={styles.dayShort} aria-hidden>
                                    {weekdayShort(date)}
                                </span>
                                <span className={styles.dayNumber} aria-hidden>
                                    {dayOfMonth(date)}
                                </span>
                            </h2>
                            <IconButton
                                className={styles.dayAdd}
                                label={`Add to ${longName}`}
                                icon={icons.add}
                                onClick={() => onAdd(date)}
                            />
                        </header>
                        {lanes.map((slot, lane) => {
                            const cellEntries = dayEntries.filter((e) => e.meal === slot)
                            const key = `${date}:${slot}`
                            return (
                                <div
                                    key={slot}
                                    className={styles.cell}
                                    style={{ gridRow: lane + 2 }}
                                    data-empty={cellEntries.length === 0 || undefined}
                                    {...dropProps(key, date, slot)}
                                >
                                    {cellEntries.length > 0 && (
                                        <ul className={styles.entries} aria-label={`${longName} ${MEAL_LABELS[slot]}`}>
                                            {cellEntries.map((entry) => (
                                                <PlanEntryItem
                                                    key={entry.id}
                                                    entry={entry}
                                                    recipe={entry.recipeId ? recipes[entry.recipeId] : undefined}
                                                    days={days}
                                                    today={today}
                                                    icons={icons}
                                                    draggable={draggable}
                                                    dragging={dragging === entry.id}
                                                    onDragStart={(event) => {
                                                        event.dataTransfer.setData(DRAG_TYPE, entry.id)
                                                        event.dataTransfer.effectAllowed = 'move'
                                                        draggingRef.current = entry.id
                                                        setDragging(entry.id)
                                                    }}
                                                    onDragEnd={() => {
                                                        draggingRef.current = null
                                                        setDragging(null)
                                                        setOver(null)
                                                    }}
                                                    onMove={(to) => onMove(entry, to)}
                                                    onRemove={() => onRemove(entry)}
                                                    onServings={() => onServings(entry)}
                                                />
                                            ))}
                                        </ul>
                                    )}
                                    <button
                                        type="button"
                                        className={styles.cellAdd}
                                        aria-label={`Add ${MEAL_LABELS[slot].toLowerCase()} on ${longName}`}
                                        onClick={() => onAdd(date, slot)}
                                    >
                                        {icons.add}
                                    </button>
                                </div>
                            )
                        })}
                    </section>
                )
            })}
        </div>
    )
}
