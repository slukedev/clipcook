'use server'

import { z } from 'zod'
import type { ActionResult } from '@/lib/domain/types'
import { fail, ok, withUser } from '@/server/action-utils'
import { rateLimit } from '@/server/rate-limit'
import { installNow, NotOwnerError, setAutoUpdate, type UpdatesView, updatesView } from '@/server/updater'

const NOT_OWNER = 'Only the account that set up ClipCook can manage updates.'

function ownerOnly<T>(fn: (uid: string) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
    return withUser(async ({ user }) => {
        try {
            return await fn(user.uid)
        } catch (err) {
            if (err instanceof NotOwnerError) return fail(NOT_OWNER)
            throw err
        }
    })
}

/** A fresh check against GitHub, skipping the cache. */
export async function checkForUpdates(): Promise<ActionResult<UpdatesView>> {
    return ownerOnly(async (uid) => {
        if (!rateLimit('updateCheck', uid).ok) return fail('Checked just now. Try again in a minute.')
        const view = await updatesView(uid, { fresh: true })
        return view ? ok(view) : fail(NOT_OWNER)
    })
}

export async function installUpdate(): Promise<ActionResult<UpdatesView>> {
    return ownerOnly(async (uid) => {
        if (!rateLimit('updateInstall', uid).ok) return fail('An update just ran. Try again in a few minutes.')
        const error = await installNow(uid)
        if (error) return fail(error)
        const view = await updatesView(uid, { fresh: true })
        return view ? ok(view) : fail(NOT_OWNER)
    })
}

export async function setAutoUpdates(on: boolean): Promise<ActionResult> {
    const parsed = z.boolean().safeParse(on)
    if (!parsed.success) return fail('Try again.')
    return ownerOnly(async (uid) => {
        await setAutoUpdate(uid, parsed.data)
        return ok(undefined)
    })
}
