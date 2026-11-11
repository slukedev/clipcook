import 'server-only'

import { after } from 'next/server'

/** Runs work after the response inside a request; outside one (scripts, tests) it runs detached. */
export function runAfter(task: () => Promise<unknown>): void {
    try {
        after(task)
    } catch {
        void task().catch(() => undefined)
    }
}
