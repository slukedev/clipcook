'use client'

import { useOptimistic, useTransition } from 'react'
import { setFavorite } from '@/actions/recipes'
import { useSnackbar } from '@/components/ui/snackbar'
import type { RecipeSummary } from '@/lib/domain/types'
import { usePendingDeletes } from './pending-deletes'

/**
 * The server's recipe list with optimistic favorites applied and recipes that are
 * waiting out their Undo window left out.
 */
export function useLibraryRecipes(recipes: RecipeSummary[]) {
    const pending = usePendingDeletes()
    const snackbar = useSnackbar()
    const [, startTransition] = useTransition()
    const [optimistic, applyFavorite] = useOptimistic(recipes, (state, change: { id: string; favorite: boolean }) =>
        state.map((r) => (r.id === change.id ? { ...r, favorite: change.favorite } : r)),
    )

    const toggleFavorite = (id: string, favorite: boolean) => {
        startTransition(async () => {
            applyFavorite({ id, favorite })
            const result = await setFavorite(id, favorite)
            if (!result.ok) {
                snackbar({
                    message: result.error,
                    action: 'Retry',
                    onAction: () => toggleFavorite(id, favorite),
                    urgent: true,
                })
            }
        })
    }

    const visible = pending.size > 0 ? optimistic.filter((r) => !pending.has(r.id)) : optimistic
    return { recipes: visible, toggleFavorite }
}
