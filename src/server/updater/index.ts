import 'server-only'

import { getStore } from '../db'
import { isInstanceOwner } from '../instance-owner'
import { resolveUpdaterSetup, tokenFormUrl, type UpdaterConfig } from './config'
import { checkForUpdate, installUpdate, recordUpdate, type UpdateStatus, updateErrorMessage } from './service'

/** Everything the Updates section in Settings renders. */
export type UpdatesView =
    | { kind: 'missing'; needsToken: boolean; needsRepo: boolean; needsBranch: boolean; tokenUrl: string }
    | {
          kind: 'ready'
          autoUpdate: boolean
          status: UpdateStatus
          lastError: string | null
          /** Files that differed here and that the last installed update replaced or removed. */
          lastReplaced: number
      }

/** Checks are cached per process so Settings and its prefetches don't hit GitHub each time. */
const STATUS_TTL_MS = 5 * 60_000
const holder = globalThis as typeof globalThis & { __clipcookUpdate?: { key: string; status: UpdateStatus } }

function cacheKey(config: UpdaterConfig): string {
    return `${config.repo}#${config.branch ?? ''}`
}

export function forgetUpdateStatus(): void {
    holder.__clipcookUpdate = undefined
}

async function setup() {
    const store = await getStore()
    return { store, setup: resolveUpdaterSetup(process.env, store.backend) }
}

async function statusFor(config: UpdaterConfig, fresh: boolean): Promise<UpdateStatus> {
    const cached = holder.__clipcookUpdate
    const now = Date.now()
    if (
        !fresh &&
        cached?.key === cacheKey(config) &&
        cached.status.state !== 'deploying' &&
        now - cached.status.checkedAt < STATUS_TTL_MS
    ) {
        return cached.status
    }
    const store = await getStore()
    const status = await checkForUpdate(config, await store.getInstance(), { now })
    holder.__clipcookUpdate = { key: cacheKey(config), status }
    return status
}

/** null when this account doesn't manage updates or the instance has nothing to update from. */
export async function updatesView(uid: string, { fresh = false } = {}): Promise<UpdatesView | null> {
    const { store, setup: s } = await setup()
    if (s.kind === 'hidden' || !(await isInstanceOwner(uid))) return null
    if (s.kind === 'missing') {
        return {
            kind: 'missing',
            needsToken: s.missing.includes('token'),
            needsRepo: s.missing.includes('repo'),
            needsBranch: s.missing.includes('branch'),
            tokenUrl: tokenFormUrl(s.repo),
        }
    }
    const [instance, status] = await Promise.all([store.getInstance(), statusFor(s.config, fresh)])
    const log = instance.lastUpdate
    return {
        kind: 'ready',
        autoUpdate: instance.autoUpdate,
        status,
        lastError: log?.outcome === 'failed' ? log.error : null,
        lastReplaced: log?.outcome === 'installed' ? log.overwritten.length : 0,
    }
}

/** Cheap: whether Settings shows the Updates section at all, without asking GitHub. */
export async function showsUpdates(uid: string): Promise<boolean> {
    const { setup: s } = await setup()
    return s.kind !== 'hidden' && (await isInstanceOwner(uid))
}

export class NotOwnerError extends Error {
    constructor() {
        super('NOT_OWNER')
        this.name = 'NotOwnerError'
    }
}

async function ownerConfig(uid: string): Promise<UpdaterConfig> {
    const { setup: s } = await setup()
    if (s.kind !== 'ready' || !(await isInstanceOwner(uid))) throw new NotOwnerError()
    return s.config
}

export async function setAutoUpdate(uid: string, on: boolean): Promise<void> {
    await ownerConfig(uid)
    const store = await getStore()
    await store.updateInstance(() => ({ autoUpdate: on }))
}

/**
 * Installs now, as the owner asked from Settings; that press is the go-ahead for an
 * update that replaces files changed here. Returns the error sentence on failure.
 */
export async function installNow(uid: string): Promise<string | null> {
    const config = await ownerConfig(uid)
    return install(config, true)
}

async function install(config: UpdaterConfig, reviewed: boolean): Promise<string | null> {
    const store = await getStore()
    const at = Date.now()
    forgetUpdateStatus()
    try {
        const result = await installUpdate(config, { reviewed })
        await recordUpdate(store, {
            at,
            outcome: result.outcome,
            upstreamSha: result.upstreamSha,
            commitSha: result.commitSha,
            error: null,
            overwritten: result.overwritten,
        })
        if (result.overwritten.length > 0 && process.env.NODE_ENV !== 'test') {
            console.warn(`Update replaced or removed ${result.overwritten.length} files changed here.`)
        }
        return null
    } catch (err) {
        const message = updateErrorMessage(err, config)
        await recordUpdate(store, {
            at,
            outcome: 'failed',
            upstreamSha: null,
            commitSha: null,
            error: message,
            overwritten: [],
        })
        return message
    } finally {
        forgetUpdateStatus()
    }
}

/** Without CRON_SECRET the schedule endpoint is public, so it runs at most this often. */
export const UNAUTHENTICATED_INTERVAL_MS = 6 * 60 * 60_000

export type AutoUpdateResult =
    | { ran: false; reason: 'not_configured' | 'off' | 'too_soon' }
    | { ran: true; error: string | null }

/** The scheduled run: installs whatever upstream has, if the owner left auto update on. */
export async function autoUpdate({ throttle }: { throttle: boolean }): Promise<AutoUpdateResult> {
    const { store, setup: s } = await setup()
    if (s.kind !== 'ready') return { ran: false, reason: 'not_configured' }
    const now = Date.now()
    const claim: { outcome: 'run' | 'off' | 'too_soon' } = { outcome: 'run' }
    // Claimed in one transaction so concurrent calls can't both get past the throttle.
    await store.updateInstance((current) => {
        claim.outcome = !current.autoUpdate
            ? 'off'
            : throttle &&
                current.lastScheduledAt !== null &&
                now - current.lastScheduledAt < UNAUTHENTICATED_INTERVAL_MS
              ? 'too_soon'
              : 'run'
        return claim.outcome === 'run' ? { lastScheduledAt: now } : null
    })
    if (claim.outcome !== 'run') return { ran: false, reason: claim.outcome }
    // Never unattended: an update that would replace files changed here waits for the owner.
    return { ran: true, error: await install(s.config, false) }
}
