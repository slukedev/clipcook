/** Mirrors the server's pairing alphabet: no 0/O or 1/I/L, so nothing can be misread. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 6

const NOT_IN_ALPHABET = new RegExp(`[^${CODE_ALPHABET}]`, 'g')

export function normalizeCode(input: string): string {
    return input.toUpperCase().replace(NOT_IN_ALPHABET, '')
}
