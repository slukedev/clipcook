'use server'

import { z } from 'zod'
import type { ActionResult, Collection } from '@/lib/domain/types'
import { LIMITS } from '@/lib/domain/types'
import { fail, invalidateApp, ok, withUser } from '@/server/action-utils'
import { collectionNameSchema, idSchema } from '@/server/schemas'

const NOT_FOUND = 'That collection no longer exists.'
const recipeIdsSchema = z.array(idSchema).min(1).max(500)

export async function createCollection(name: string): Promise<ActionResult<Collection>> {
    return withUser(async ({ user, store }) => {
        const clean = collectionNameSchema.parse(name)
        const existing = await store.listCollections(user.uid)
        if (existing.length >= LIMITS.collections) return fail('You have the maximum number of collections.')
        const dupe = existing.find((c) => c.name.toLowerCase() === clean.toLowerCase())
        if (dupe) return fail('A collection with that name already exists.')
        const now = Date.now()
        const record = { id: store.newId(), uid: user.uid, name: clean, createdAt: now, updatedAt: now }
        await store.createCollection(record)
        invalidateApp()
        return ok({ id: record.id, name: clean, createdAt: now, recipeCount: 0, coverThumbnails: [] })
    })
}

export async function renameCollection(id: string, name: string): Promise<ActionResult> {
    return withUser(async ({ user, store }) => {
        const clean = collectionNameSchema.parse(name)
        await store.updateCollection(user.uid, idSchema.parse(id), (c) =>
            c.name === clean ? null : { name: clean, updatedAt: Date.now() },
        )
        invalidateApp()
        return ok(undefined)
    }, NOT_FOUND)
}

/** Deletes the collection only; its recipes stay in the library. */
export async function deleteCollection(id: string): Promise<ActionResult> {
    return withUser(async ({ user, store }) => {
        await store.deleteCollection(user.uid, idSchema.parse(id))
        invalidateApp()
        return ok(undefined)
    }, NOT_FOUND)
}

/** Returns how many recipes changed. */
export async function addToCollection(id: string, recipeIds: string[]): Promise<ActionResult<number>> {
    return withUser(async ({ user, store }) => {
        const changed = await store.setCollectionMembership(
            user.uid,
            idSchema.parse(id),
            recipeIdsSchema.parse(recipeIds),
            true,
        )
        invalidateApp()
        return ok(changed)
    }, NOT_FOUND)
}

export async function removeFromCollection(id: string, recipeIds: string[]): Promise<ActionResult<number>> {
    return withUser(async ({ user, store }) => {
        const changed = await store.setCollectionMembership(
            user.uid,
            idSchema.parse(id),
            recipeIdsSchema.parse(recipeIds),
            false,
        )
        invalidateApp()
        return ok(changed)
    }, NOT_FOUND)
}
