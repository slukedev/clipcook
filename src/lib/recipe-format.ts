import Fraction from 'fraction.js'

const NAMED_ENTITIES: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ndash: '–',
    mdash: '—',
    hellip: '…',
    lsquo: '‘',
    rsquo: '’',
    ldquo: '“',
    rdquo: '”',
    deg: '°',
    frac12: '½',
    frac14: '¼',
    frac34: '¾',
}

export function unescapeHtml(str: string): string {
    return str
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
        .replace(/&([a-z][a-z0-9]*);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
}

function parseAmount(raw: string): number {
    if (raw.includes('/')) {
        const [a, b] = raw.split('/')
        const num = Number(a)
        const den = Number(b)
        return Number.isFinite(num) && Number.isFinite(den) && den !== 0 ? num / den : Number.NaN
    }
    return Number(raw)
}

/**
 * Scales only the first numeric amount in the ingredient. Replacing every
 * number would rewrite things like "350° oven" or "stir for 5 minutes"
 * alongside the actual quantity.
 */
export function scaleIngredient(ingredient: string, scale: number): string {
    const amountRegex = /\d+\/\d+|\d+\.\d+|\d+/
    let replaced = false
    return ingredient.replace(amountRegex, (match) => {
        if (replaced) return match
        replaced = true
        const n = parseAmount(match)
        if (!Number.isFinite(n)) return match
        return String(Math.round(n * scale * 1000) / 1000)
    })
}

/** Pretty-prints decimals as unicode-friendly mixed fractions (0.5 → 1/2). */
export function formatAmounts(text: string): string {
    return text.replace(/-?\d+(?:\.\d+)?/g, (n) => {
        try {
            return new Fraction(n).simplify(0.001).toFraction(true)
        } catch {
            return n
        }
    })
}

/** Full display pipeline for an ingredient line at a given scale. */
export function displayIngredient(ingredient: string, scale: number): string {
    return formatAmounts(unescapeHtml(scaleIngredient(ingredient, scale)))
}

export function formatFraction(value: number): string {
    try {
        return new Fraction(value).simplify(0.001).toFraction(true)
    } catch {
        return String(value)
    }
}
