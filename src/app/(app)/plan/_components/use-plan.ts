'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { useSnackbar } from '@/components/ui/snackbar'
import type { ActionResult, PlanEntry } from '@/lib/domain/types'
import { addEntries, sortEntries } from '@/lib/plan/entries'

export type PlanOp =
    | { type: 'add'; entries: PlanEntry[] }
    | { type: 'update'; id: string; patch: Partial<PlanEntry> }
    | { type: 'mark'; ids: readonly string[]; groceryAddedAt: number }
    | { type: 'remove'; ids: readonly string[] }

export function reducePlan(entries: PlanEntry[], op: PlanOp): PlanEntry[] {
    switch (op.type) {
        case 'add':
            return addEntries(entries, op.entries)
        case 'update':
            return sortEntries(entries.map((e) => (e.id === op.id ? { ...e, ...op.patch } : e)))
        case 'mark': {
            const ids = new Set(op.ids)
            return entries.map((e) => (ids.has(e.id) ? { ...e, groceryAddedAt: op.groceryAddedAt } : e))
        }
        case 'remove': {
            const ids = new Set(op.ids)
            return entries.filter((e) => !ids.has(e.id))
        }
    }
}

/** Ids the server accepts, so an optimistic row keeps its id once saved. */
export function newEntryId(): string {
    return crypto.randomUUID().replaceAll('-', '')
}

/**
 * The week's entries with optimistic edits on top. Each edit shows at once; when the
 * server says no, the edit falls away and a snackbar says why.
 */
export function usePlanEntries(entries: PlanEntry[]) {
    const snackbar = useSnackbar()
    const [, startTransition] = useTransition()
    // Server results and refreshed props both reset the base the optimistic layer sits on.
    const [base, setBase] = useState(entries)
    const [prevEntries, setPrevEntries] = useState(entries)
    if (entries !== prevEntries) {
        setPrevEntries(entries)
        setBase(entries)
    }
    const [optimistic, apply] = useOptimistic(base, reducePlan)

    function run<T>(
        op: PlanOp | null,
        action: () => Promise<ActionResult<T>>,
        settle?: (data: T) => PlanOp | null,
        after?: (data: T) => void,
    ): void {
        startTransition(async () => {
            if (op) apply(op)
            const res = await action()
            if (!res.ok) {
                snackbar({ message: res.error, urgent: true })
                return
            }
            const final = settle ? settle(res.data) : op
            startTransition(() => {
                if (final) setBase((current) => reducePlan(current, final))
            })
            after?.(res.data)
        })
    }

    return { entries: optimistic, run }
}
