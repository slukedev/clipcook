/** Custom message channel shared by the Cast sender (phone) and receiver (/display/cast). */
export const CAST_NAMESPACE = 'urn:x-cast:app.clipcook'

/** What the receiver answers a claim with. */
export type CastReply =
    | { type: 'claimed' }
    | { type: 'error'; reason: 'expired' | 'failed' }
    | { type: 'error'; reason: 'origin'; origin: string }

export function parseCastReply(message: unknown): CastReply | null {
    let data = message
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data)
        } catch {
            return null
        }
    }
    if (typeof data !== 'object' || data === null) return null
    const m = data as Record<string, unknown>
    if (m.type === 'claimed') return { type: 'claimed' }
    if (m.type !== 'error') return null
    if (m.reason === 'origin' && typeof m.origin === 'string')
        return { type: 'error', reason: 'origin', origin: m.origin }
    return { type: 'error', reason: m.reason === 'expired' ? 'expired' : 'failed' }
}
