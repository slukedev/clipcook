import { lastSeenLabel } from '@/app/(app)/settings/displays/last-seen'
import styles from './display-presence.module.scss'

export type Presence = 'online' | 'offline' | 'unlinked'

/** What a send menu needs to tell displays apart. */
export interface DisplayPresence {
    id: string
    name: string
    lastSeenAt: number | null
    presence: Presence
    /** Title of the recipe it shows now, with the step when it follows one. */
    showing: string | null
}

const RANK: Record<Presence, number> = { online: 0, offline: 1, unlinked: 2 }

/** Screens that are on right now first, then the most recently seen, unlinked ones last. */
export function sortByPresence<T extends DisplayPresence>(displays: readonly T[]): T[] {
    return displays.toSorted(
        (a, b) => RANK[a.presence] - RANK[b.presence] || (b.lastSeenAt ?? -1) - (a.lastSeenAt ?? -1),
    )
}

/**
 * Snackbar text after a send, from what the server says about the screen: one that is
 * off or never linked is told so instead of a false "Showing on".
 */
export function sentMessage(
    sent: { name: string; presence: Presence },
    lastSeenAt: number | null,
    now: number,
): string {
    if (sent.presence === 'online') return `Showing on ${sent.name}`
    if (sent.presence === 'unlinked') return `Sent to ${sent.name}, but it never finished linking.`
    return `Sent to ${sent.name}. Last seen ${lastSeenLabel(lastSeenAt, now).toLowerCase()}.`
}

function statusLabel(display: DisplayPresence, now: number): string {
    if (display.presence === 'unlinked') return 'Not linked'
    if (display.presence === 'online') return 'Active now'
    return lastSeenLabel(display.lastSeenAt, now)
}

/**
 * A display as a menu row: its name, then whether it is on and what it shows, so two
 * screens with similar names can still be told apart.
 */
export function DisplayLabel({ display, now }: { display: DisplayPresence; now: number }) {
    return (
        <span className={styles.text}>
            <span className={styles.name}>{display.name}</span>
            <span className={styles.meta}>
                <span className={styles.dot} data-presence={display.presence} aria-hidden />
                <span className={styles.status}>
                    {statusLabel(display, now)}
                    {display.showing && `, ${display.showing}`}
                </span>
            </span>
        </span>
    )
}
