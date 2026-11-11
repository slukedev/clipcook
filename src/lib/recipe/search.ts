// Search text helpers shared by the library (client) and the server search. Client-safe.

/** Lowercase without accents, so "creme" finds "Crème". */
export function fold(text: string): string {
    return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function queryTokens(query: string): string[] {
    return fold(query).split(/\s+/).filter(Boolean)
}
