import 'server-only'

interface Bucket {
    tokens: number
    lastRefill: number
}

const buckets = new Map<string, Bucket>()

/**
 * In-memory token bucket. Per serverless instance — a determined abuser can
 * fan out across instances, but this bounds the realistic per-user rate of
 * expensive operations (outbound scraping) at zero infra cost. Swap for a
 * Firestore-counter limiter if the app ever needs a global guarantee.
 */
export function checkRateLimit(key: string, maxTokens = 10, refillPerSecond = 0.2): boolean {
    const now = Date.now()
    const bucket = buckets.get(key) ?? { tokens: maxTokens, lastRefill: now }
    bucket.tokens = Math.min(maxTokens, bucket.tokens + ((now - bucket.lastRefill) / 1000) * refillPerSecond)
    bucket.lastRefill = now
    if (bucket.tokens < 1) {
        buckets.set(key, bucket)
        return false
    }
    bucket.tokens -= 1
    buckets.set(key, bucket)

    // Bound memory: drop stale buckets once in a while.
    if (buckets.size > 10_000) {
        for (const [k, b] of buckets) {
            if (now - b.lastRefill > 3_600_000) buckets.delete(k)
        }
    }
    return true
}
