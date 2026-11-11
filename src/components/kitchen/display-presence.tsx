import { isActive, lastSeenLabel } from '@/app/(app)/settings/displays/last-seen'
import styles from './display-presence.module.scss'

/** What a send menu needs to tell displays apart. */
export interface DisplayPresence {
    id: string
    name: string
    lastSeenAt: number | null
    /** Title of the recipe it shows now, with the step when it follows one. */
    showing: string | null
}

/** Screens that are on right now first, then the most recently seen. */
export function sortByPresence<T extends DisplayPresence>(displays: readonly T[]): T[] {
    return displays.toSorted((a, b) => (b.lastSeenAt ?? -1) - (a.lastSeenAt ?? -1))
}

/** Snackbar text after a send: a screen that is off gets told so instead of a false "Showing". */
export function sentMessage(display: DisplayPresence, now: number): string {
    if (isActive(display.lastSeenAt, now)) return `Showing on ${display.name}`
    if (display.lastSeenAt === null) return `Sent to ${display.name}. It has not connected yet.`
    return `Sent to ${display.name}. Last seen ${lastSeenLabel(display.lastSeenAt, now).toLowerCase()}.`
}

/**
 * A display as a menu row: its name, then whether it is on and what it shows, so two
 * screens called "Kitchen" can still be told apart.
 */
export function DisplayLabel({ display, now }: { display: DisplayPresence; now: number }) {
    const active = isActive(display.lastSeenAt, now)
    return (
        <span className={styles.text}>
            <span className={styles.name}>{display.name}</span>
            <span className={styles.meta}>
                <span className={styles.dot} data-active={active || undefined} aria-hidden />
                <span className={styles.status}>
                    {lastSeenLabel(display.lastSeenAt, now)}
                    {display.showing && `, ${display.showing}`}
                </span>
            </span>
        </span>
    )
}
