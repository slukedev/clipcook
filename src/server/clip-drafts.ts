import 'server-only'

import type { ImportedRecipe } from '@/lib/domain/types'
import { randomToken } from './crypto'
import type { Store } from './db/types'

export const CLIP_DRAFT_TTL_MS = 15 * 60_000

/** Parks a bookmarklet clip until the user (maybe after signing in) opens /clip?draft=. */
export async function saveClipDraft(store: Store, recipe: ImportedRecipe, now = Date.now()): Promise<string> {
    const id = randomToken(16)
    await store.createClipDraft({ id, recipe, createdAt: now, expiresAt: now + CLIP_DRAFT_TTL_MS })
    return id
}

export async function loadClipDraft(store: Store, id: string, now = Date.now()): Promise<ImportedRecipe | null> {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(id)) return null
    return (await store.getClipDraft(id, now))?.recipe ?? null
}
