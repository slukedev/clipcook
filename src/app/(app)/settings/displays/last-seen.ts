// Displays write lastSeenAt at most once a minute while they poll, so anything newer
// than a couple of heartbeats means the screen is on right now.
const ACTIVE_MS = 2.5 * 60_000

export function isActive(lastSeenAt: number | null, now: number): boolean {
    return lastSeenAt !== null && now - lastSeenAt < ACTIVE_MS
}

export function lastSeenLabel(lastSeenAt: number | null, now: number): string {
    if (lastSeenAt === null) return 'Not seen yet'
    const ms = Math.max(0, now - lastSeenAt)
    if (ms < ACTIVE_MS) return 'Active now'
    const minutes = Math.round(ms / 60_000)
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours} h ago`
    const days = Math.round(hours / 24)
    return days === 1 ? 'Yesterday' : `${days} days ago`
}
