import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** URL-safe random token; 16 bytes is 128 bits. */
export function randomToken(bytes = 16): string {
    return randomBytes(bytes).toString('base64url')
}

export function sha256(value: string): string {
    return createHash('sha256').update(value).digest('base64url')
}

export function hmac(secret: string | Buffer, value: string): string {
    return createHmac('sha256', secret).update(value).digest('base64url')
}

export function safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a)
    const bb = Buffer.from(b)
    return ba.length === bb.length && timingSafeEqual(ba, bb)
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Human-friendly code without look-alike characters (no 0/O, 1/I/L). Rejection sampling keeps it uniform. */
export function randomCode(length = 6): string {
    let out = ''
    while (out.length < length) {
        for (const byte of randomBytes(length * 2)) {
            if (byte < 248 && out.length < length) out += CODE_ALPHABET[byte % CODE_ALPHABET.length]
        }
    }
    return out
}

export function normalizeCode(input: string): string {
    return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{6}$`)
