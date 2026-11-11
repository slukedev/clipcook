'use server'

import type { ActionResult, ImportCounts } from '@/lib/domain/types'
import { fail, invalidateApp, ok, withUser } from '@/server/action-utils'
import { ImportError, importExport, MAX_IMPORT_BYTES, parseExport } from '@/server/data-transfer'
import { rateLimit } from '@/server/rate-limit'

/**
 * Merges a ClipCook export (FormData field `file`) into the library. Server actions
 * are capped by next.config's bodySizeLimit; POST /api/import takes the same file
 * without that cap when an export is larger.
 */
export async function importData(formData: FormData): Promise<ActionResult<ImportCounts>> {
    return withUser(async ({ user, store }) => {
        const file = formData.get('file')
        if (!(file instanceof File) || file.size === 0) return fail('Choose an export file.')
        if (file.size > MAX_IMPORT_BYTES) return fail('That file is over 25 MB.')
        if (!rateLimit('importData', user.uid).ok) return fail('Too many imports. Try again in a few minutes.')
        try {
            const counts = await importExport(store, user.uid, parseExport(await file.text()))
            invalidateApp()
            return ok(counts)
        } catch (err) {
            if (err instanceof ImportError) return fail(err.message)
            throw err
        }
    })
}
