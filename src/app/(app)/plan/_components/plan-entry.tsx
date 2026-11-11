'use client'

import Link from 'next/link'
import type { DragEvent } from 'react'
import { IconButton } from '@/components/ui/icon-button'
import {
    Menu,
    MenuContent,
    MenuItem,
    MenuLinkItem,
    MenuRadioGroup,
    MenuRadioItem,
    MenuSeparator,
    MenuTrigger,
    Submenu,
} from '@/components/ui/menu'
import type { MealSlot, PlanEntry, RecipeSummary } from '@/lib/domain/types'
import { MEAL_LABELS, MEAL_SLOTS } from '@/lib/plan/entries'
import { addDays, shortDate, weekdayName, weekdayShort } from '@/lib/plan/week'
import { formatMinutes } from '@/lib/recipe/time'
import { RecipeMedia } from '../../_library/recipe-media'
import type { PlanIcons } from './icons'
import styles from './plan.module.scss'

/** '6 servings', shown only when the plan changes the recipe's own count. */
export function servingsLabel(servings: number | null): string {
    if (servings === null) return ''
    return servings === 1 ? '1 serving' : `${servings} servings`
}

export function recipeTime(recipe: Pick<RecipeSummary, 'totalMinutes' | 'totalTime'> | undefined): string {
    if (!recipe) return ''
    return recipe.totalMinutes ? formatMinutes(recipe.totalMinutes) : recipe.totalTime
}

export interface PlanEntryItemProps {
    entry: PlanEntry
    recipe: RecipeSummary | undefined
    days: string[]
    today: string
    icons: PlanIcons
    draggable: boolean
    dragging: boolean
    onDragStart: (event: DragEvent) => void
    onDragEnd: () => void
    onMove: (to: { date?: string; meal?: MealSlot }) => void
    onRemove: () => void
    onServings: () => void
}

export function PlanEntryItem({
    entry,
    recipe,
    days,
    today,
    icons,
    draggable,
    dragging,
    onDragStart,
    onDragEnd,
    onMove,
    onRemove,
    onServings,
}: PlanEntryItemProps) {
    const title = recipe ? recipe.title : entry.note
    const meta = [
        entry.meal === 'dinner' ? '' : MEAL_LABELS[entry.meal],
        servingsLabel(entry.servings),
        recipeTime(recipe),
    ].filter(Boolean)
    const nextWeek = addDays(entry.date, 7)

    const body = (
        <>
            <span className={styles.thumb} data-note={recipe ? undefined : ''}>
                {recipe ? (
                    <RecipeMedia src={recipe.thumbnail} title={recipe.title} sizes="(width < 840px) 56px, 200px" />
                ) : (
                    <span className={styles.noteIcon}>
                        {entry.note.toLowerCase() === 'eat out' ? icons.eatOut : icons.note}
                    </span>
                )}
            </span>
            <span className={styles.entryText}>
                <span className={styles.entryTitle}>{title}</span>
                {meta.length > 0 && (
                    <span className={styles.entryMeta}>
                        {meta.map((part, i) => (
                            <span key={part}>
                                {i > 0 && ' · '}
                                <span className={styles.metaPart}>{part}</span>
                            </span>
                        ))}
                    </span>
                )}
            </span>
        </>
    )

    return (
        <li
            className={styles.entry}
            data-dragging={dragging || undefined}
            data-note={recipe ? undefined : ''}
            draggable={draggable || undefined}
            onDragStart={draggable ? onDragStart : undefined}
            onDragEnd={draggable ? onDragEnd : undefined}
        >
            {recipe ? (
                <Link href={`/recipe/${recipe.id}`} className={styles.entryLink}>
                    {body}
                </Link>
            ) : (
                <div className={styles.entryLink}>{body}</div>
            )}
            <Menu>
                <MenuTrigger
                    render={
                        <IconButton
                            className={styles.entryMenu}
                            label={`${title} options`}
                            icon={icons.more}
                            size="s"
                        />
                    }
                />
                <MenuContent align="end">
                    {recipe && (
                        <MenuLinkItem icon={icons.open} render={<Link href={`/recipe/${recipe.id}`} />}>
                            Open recipe
                        </MenuLinkItem>
                    )}
                    <Submenu label="Move to" icon={icons.move}>
                        <MenuRadioGroup value={entry.date} onValueChange={(date) => onMove({ date: date as string })}>
                            {days.map((date) => (
                                <MenuRadioItem key={date} value={date}>
                                    {date === today ? 'Today' : `${weekdayShort(date)}, ${shortDate(date)}`}
                                </MenuRadioItem>
                            ))}
                        </MenuRadioGroup>
                        <MenuSeparator />
                        <MenuItem onClick={() => onMove({ date: nextWeek })}>
                            {`Next ${weekdayName(nextWeek)}`}
                        </MenuItem>
                    </Submenu>
                    <Submenu label="Meal" icon={icons.meal}>
                        <MenuRadioGroup value={entry.meal} onValueChange={(meal) => onMove({ meal: meal as MealSlot })}>
                            {MEAL_SLOTS.map((slot) => (
                                <MenuRadioItem key={slot} value={slot}>
                                    {MEAL_LABELS[slot]}
                                </MenuRadioItem>
                            ))}
                        </MenuRadioGroup>
                    </Submenu>
                    {recipe && (
                        <MenuItem
                            icon={icons.servings}
                            onClick={onServings}
                            trailing={
                                entry.servings ? <span className={styles.menuCount}>{entry.servings}</span> : undefined
                            }
                        >
                            Servings
                        </MenuItem>
                    )}
                    <MenuSeparator />
                    <MenuItem icon={icons.remove} onClick={onRemove}>
                        Remove
                    </MenuItem>
                </MenuContent>
            </Menu>
        </li>
    )
}
