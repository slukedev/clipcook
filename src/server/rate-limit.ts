import 'server-only'

import net from 'node:net'

export interface RateLimitPolicy {
    /** Burst size. */
    capacity: number
    /** Tokens restored per second. */
    refillPerSecond: number
}

/**
 * Named policies. These buckets live in process memory: each server instance
 * enforces them on its own, so a client spread across N instances gets up to N
 * times the budget. That still bounds abuse of the expensive paths (outbound
 * fetches, code guessing) at zero infrastructure cost; move to a shared store
 * (Firestore counters, Redis) if a global guarantee is ever needed.
 */
export const RATE_LIMITS = {
    /** Server-side URL clipping, per user. */
    clipUrl: { capacity: 10, refillPerSecond: 10 / 60 },
    /** Bookmarklet posts, per IP. */
    clipIngest: { capacity: 20, refillPerSecond: 20 / 300 },
    /** Display pairing codes, per IP. */
    pairStart: { capacity: 6, refillPerSecond: 6 / 600 },
    /** Pairing status polls, per IP; displays poll every couple of seconds. */
    pairPoll: { capacity: 60, refillPerSecond: 1 },
    /** Code claims, per user: 10 guesses per 10 minutes against a 31^6 space. */
    pairClaim: { capacity: 10, refillPerSecond: 10 / 600 },
    /** Cast tokens, per user. */
    castToken: { capacity: 10, refillPerSecond: 10 / 600 },
    /** Cast token redemption, per IP. */
    castClaim: { capacity: 10, refillPerSecond: 10 / 600 },
    /** Display reads, per display. */
    displayRead: { capacity: 120, refillPerSecond: 2 },
    /** Data import, per user. */
    importData: { capacity: 3, refillPerSecond: 3 / 600 },
    /** Update checks against GitHub, per user. */
    updateCheck: { capacity: 4, refillPerSecond: 4 / 60 },
    /** Update installs, per user. */
    updateInstall: { capacity: 2, refillPerSecond: 2 / 600 },
} satisfies Record<string, RateLimitPolicy>

export type RateLimitName = keyof typeof RATE_LIMITS

interface Bucket {
    tokens: number
    updatedAt: number
}

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 20_000

export interface RateLimitResult {
    ok: boolean
    /** Seconds until one token is available. */
    retryAfter: number
}

export function rateLimit(policy: RateLimitName | RateLimitPolicy, key: string, now = Date.now()): RateLimitResult {
    const p = typeof policy === 'string' ? RATE_LIMITS[policy] : policy
    const id = `${typeof policy === 'string' ? policy : `${p.capacity}/${p.refillPerSecond}`}:${key}`
    const bucket = buckets.get(id) ?? { tokens: p.capacity, updatedAt: now }
    bucket.tokens = Math.min(p.capacity, bucket.tokens + ((now - bucket.updatedAt) / 1000) * p.refillPerSecond)
    bucket.updatedAt = now
    // Delete then set keeps Map insertion order roughly LRU for the sweep below.
    buckets.delete(id)
    buckets.set(id, bucket)
    if (buckets.size > MAX_BUCKETS) {
        for (const k of buckets.keys()) {
            buckets.delete(k)
            if (buckets.size <= MAX_BUCKETS * 0.9) break
        }
    }
    if (bucket.tokens < 1) {
        return { ok: false, retryAfter: Math.ceil((1 - bucket.tokens) / p.refillPerSecond) }
    }
    bucket.tokens -= 1
    return { ok: true, retryAfter: 0 }
}

/** Legacy boolean form. */
export function checkRateLimit(key: string, maxTokens = 10, refillPerSecond = 0.2): boolean {
    return rateLimit({ capacity: maxTokens, refillPerSecond }, key).ok
}

/** Tests only. */
export function resetRateLimits(): void {
    buckets.clear()
}

/**
 * The client address for rate limiting. Only the hops our own proxies append are
 * trusted: on Vercel that is x-real-ip; elsewhere the entry TRUST_PROXY_HOPS from
 * the right of x-forwarded-for (leftmost entries are whatever the client sent).
 * IPv6 clients are bucketed by /64 since one host usually owns the whole prefix.
 */
export function clientIp(headers: Headers, env: Record<string, string | undefined> = process.env): string {
    let candidate: string | undefined
    if (env.VERCEL) candidate = headers.get('x-real-ip') ?? undefined
    if (!candidate) {
        const hops = Math.max(1, Number(env.TRUST_PROXY_HOPS ?? 1) || 1)
        const chain = (headers.get('x-forwarded-for') ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        candidate = chain[chain.length - hops] ?? chain[0]
    }
    candidate ??= headers.get('x-real-ip') ?? undefined
    if (!candidate) return 'unknown'
    const bare = candidate.replace(/^\[|\](:\d+)?$/g, '').replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, '$1')
    if (net.isIPv4(bare)) return bare
    if (net.isIPv6(bare)) {
        const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(bare)
        if (mapped?.[1]) return mapped[1]
        const groups = bare.split('::')
        const head = (groups[0] ?? '').split(':').filter(Boolean)
        const tail = groups.length > 1 ? (groups[1] ?? '').split(':').filter(Boolean) : []
        const full = [...head, ...new Array(Math.max(0, 8 - head.length - tail.length)).fill('0'), ...tail]
        return `${full.slice(0, 4).join(':')}::/64`
    }
    return 'unknown'
}
