// Ingredient line parsing, scaling, and fraction formatting. Client-safe.

import { isHeadingLine, normalizeFractions } from './text'

export interface ParsedIngredient {
    raw: string
    quantity: number | null
    /** Upper bound for ranges like '2-3'. */
    quantityMax: number | null
    /** Canonical unit id ('cup', 'tbsp', 'g', ...), or null. */
    unit: string | null
    /** The unit exactly as written. */
    unitText: string | null
    name: string
    note: string | null
    isHeading: boolean
}

interface UnitDef {
    id: string
    singular: string
    plural: string
    aliases: string[]
    /** Aliases that only match with this exact case ('T' is tablespoon, 't' is teaspoon). */
    exact?: string[]
    /** Metric units format as decimals, never as fractions. */
    metric?: boolean
}

const UNITS: UnitDef[] = [
    {
        id: 'tsp',
        singular: 'teaspoon',
        plural: 'teaspoons',
        aliases: ['tsp', 'tsps', 'teaspoon', 'teaspoons', 'tspn'],
        exact: ['t'],
    },
    {
        id: 'tbsp',
        singular: 'tablespoon',
        plural: 'tablespoons',
        aliases: ['tbsp', 'tbsps', 'tbs', 'tbl', 'tbls', 'tablespoon', 'tablespoons', 'tblsp'],
        exact: ['T', 'Tb'],
    },
    { id: 'cup', singular: 'cup', plural: 'cups', aliases: ['cup', 'cups', 'c'] },
    {
        id: 'floz',
        singular: 'fl oz',
        plural: 'fl oz',
        aliases: ['fl oz', 'fl. oz', 'fluid ounce', 'fluid ounces', 'floz'],
    },
    { id: 'oz', singular: 'ounce', plural: 'ounces', aliases: ['oz', 'ounce', 'ounces', 'ozs'] },
    { id: 'lb', singular: 'pound', plural: 'pounds', aliases: ['lb', 'lbs', 'pound', 'pounds', '#'] },
    { id: 'g', singular: 'g', plural: 'g', aliases: ['g', 'gr', 'gram', 'grams', 'gramme', 'grammes'], metric: true },
    {
        id: 'kg',
        singular: 'kg',
        plural: 'kg',
        aliases: ['kg', 'kgs', 'kilogram', 'kilograms', 'kilo', 'kilos'],
        metric: true,
    },
    { id: 'mg', singular: 'mg', plural: 'mg', aliases: ['mg', 'milligram', 'milligrams'], metric: true },
    {
        id: 'ml',
        singular: 'ml',
        plural: 'ml',
        aliases: ['ml', 'mls', 'milliliter', 'milliliters', 'millilitre', 'millilitres', 'cc'],
        metric: true,
    },
    { id: 'cl', singular: 'cl', plural: 'cl', aliases: ['cl', 'centiliter', 'centilitre'], metric: true },
    { id: 'dl', singular: 'dl', plural: 'dl', aliases: ['dl', 'deciliter', 'decilitre'], metric: true },
    { id: 'l', singular: 'l', plural: 'l', aliases: ['l', 'liter', 'liters', 'litre', 'litres', 'ltr'], metric: true },
    { id: 'pint', singular: 'pint', plural: 'pints', aliases: ['pint', 'pints', 'pt', 'pts'] },
    { id: 'quart', singular: 'quart', plural: 'quarts', aliases: ['quart', 'quarts', 'qt', 'qts'] },
    { id: 'gallon', singular: 'gallon', plural: 'gallons', aliases: ['gallon', 'gallons', 'gal', 'gals'] },
    { id: 'pinch', singular: 'pinch', plural: 'pinches', aliases: ['pinch', 'pinches'] },
    { id: 'dash', singular: 'dash', plural: 'dashes', aliases: ['dash', 'dashes'] },
    { id: 'drop', singular: 'drop', plural: 'drops', aliases: ['drop', 'drops'] },
    { id: 'clove', singular: 'clove', plural: 'cloves', aliases: ['clove', 'cloves'] },
    { id: 'can', singular: 'can', plural: 'cans', aliases: ['can', 'cans', 'tin', 'tins'] },
    { id: 'jar', singular: 'jar', plural: 'jars', aliases: ['jar', 'jars'] },
    { id: 'bottle', singular: 'bottle', plural: 'bottles', aliases: ['bottle', 'bottles'] },
    {
        id: 'package',
        singular: 'package',
        plural: 'packages',
        aliases: ['package', 'packages', 'pkg', 'pkgs', 'pack', 'packs', 'packet', 'packets'],
    },
    { id: 'box', singular: 'box', plural: 'boxes', aliases: ['box', 'boxes'] },
    { id: 'bag', singular: 'bag', plural: 'bags', aliases: ['bag', 'bags'] },
    { id: 'stick', singular: 'stick', plural: 'sticks', aliases: ['stick', 'sticks'] },
    { id: 'slice', singular: 'slice', plural: 'slices', aliases: ['slice', 'slices'] },
    { id: 'bunch', singular: 'bunch', plural: 'bunches', aliases: ['bunch', 'bunches'] },
    { id: 'sprig', singular: 'sprig', plural: 'sprigs', aliases: ['sprig', 'sprigs'] },
    { id: 'head', singular: 'head', plural: 'heads', aliases: ['head', 'heads'] },
    { id: 'stalk', singular: 'stalk', plural: 'stalks', aliases: ['stalk', 'stalks'] },
    { id: 'handful', singular: 'handful', plural: 'handfuls', aliases: ['handful', 'handfuls'] },
    { id: 'piece', singular: 'piece', plural: 'pieces', aliases: ['piece', 'pieces', 'pc', 'pcs'] },
    { id: 'sheet', singular: 'sheet', plural: 'sheets', aliases: ['sheet', 'sheets'] },
    { id: 'envelope', singular: 'envelope', plural: 'envelopes', aliases: ['envelope', 'envelopes'] },
    { id: 'scoop', singular: 'scoop', plural: 'scoops', aliases: ['scoop', 'scoops'] },
    { id: 'inch', singular: 'inch', plural: 'inches', aliases: ['inch', 'inches', 'in'] },
    {
        id: 'cm',
        singular: 'cm',
        plural: 'cm',
        aliases: ['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres'],
        metric: true,
    },
]

const UNIT_BY_ALIAS = new Map<string, UnitDef>()
const UNIT_BY_EXACT = new Map<string, UnitDef>()
for (const unit of UNITS) {
    for (const alias of unit.aliases) UNIT_BY_ALIAS.set(alias, unit)
    for (const alias of unit.exact ?? []) UNIT_BY_EXACT.set(alias, unit)
}

export function unitDef(id: string | null): UnitDef | undefined {
    return id ? UNITS.find((u) => u.id === id) : undefined
}

const WORD_NUMBERS: Record<string, number> = {
    a: 1,
    an: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    dozen: 12,
    half: 0.5,
}

const NUM = String.raw`(?:\d+\s+\d+\/\d+|\d+-\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|\.\d+)`
const WORD = String.raw`(?:an?(?!\s+(?:few|couple|little|bit|good|generous|splash|drizzle)\b)|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half)`
const LEADING_QTY = new RegExp(
    String.raw`^(?<qty>${NUM}|${WORD}(?=\s))(?:\s*(?:-|–|\u2014|to|or)\s*(?<max>${NUM}))?(?=$|[\s(a-zA-Z])`,
    'i',
)

function toNumber(token: string): number | null {
    const t = token.trim().toLowerCase()
    if (t in WORD_NUMBERS) return WORD_NUMBERS[t] ?? null
    const mixed = /^(\d+)[\s-]+(\d+)\/(\d+)$/.exec(t)
    if (mixed) return Number(mixed[3]) === 0 ? null : Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
    const frac = /^(\d+)\/(\d+)$/.exec(t)
    if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2])
    const n = Number(t)
    return Number.isFinite(n) ? n : null
}

interface UnitMatch {
    unit: UnitDef
    text: string
    length: number
}

function matchUnit(rest: string): UnitMatch | null {
    const m = /^([A-Za-z#]+\.?)(?:\s+([A-Za-z]+\.?))?/.exec(rest)
    if (!m) return null
    const first = m[1] ?? ''
    const second = m[2]
    if (second) {
        const two = `${first.replace(/\.$/, '')} ${second.replace(/\.$/, '')}`
        const unit = UNIT_BY_ALIAS.get(two.toLowerCase())
        if (unit) return { unit, text: `${first} ${second}`, length: first.length + 1 + second.length }
    }
    const bare = first.replace(/\.$/, '')
    const exact = UNIT_BY_EXACT.get(bare)
    if (exact) return { unit: exact, text: first, length: first.length }
    const unit = UNIT_BY_ALIAS.get(bare.toLowerCase())
    // A single letter like 'c' or 'l' only counts as a unit when something follows it.
    if (unit && (bare.length > 1 || rest.length > first.length)) return { unit, text: first, length: first.length }
    return null
}

interface Spans {
    parsed: ParsedIngredient
    /** Character range of the leading quantity in the normalized line. */
    qtySpan: [number, number] | null
    unitSpan: [number, number] | null
    /** A '(190 g)' right after the unit: an equivalent amount that scales with the line. */
    equivalentSpan: [number, number] | null
    text: string
}

function analyze(line: string): Spans {
    const text = normalizeFractions(line.trim())
    const base: ParsedIngredient = {
        raw: line,
        quantity: null,
        quantityMax: null,
        unit: null,
        unitText: null,
        name: text,
        note: null,
        isHeading: isHeadingLine(text),
    }
    if (base.isHeading) return { parsed: base, qtySpan: null, unitSpan: null, equivalentSpan: null, text }

    let pos = 0
    let qtySpan: [number, number] | null = null
    let unitSpan: [number, number] | null = null
    let equivalentSpan: [number, number] | null = null
    const notes: string[] = []

    const qm = LEADING_QTY.exec(text)
    if (qm?.groups?.qty) {
        const q = toNumber(qm.groups.qty)
        if (q !== null) {
            base.quantity = q
            base.quantityMax = qm.groups.max ? toNumber(qm.groups.max) : null
            qtySpan = [0, qm[0].length]
            pos = qm[0].length
        }
    }

    const skipSpace = () => {
        while (text[pos] === ' ') pos++
    }
    skipSpace()

    // '1 (14 oz) can': a package size between quantity and unit. It never scales.
    if (qtySpan && text[pos] === '(') {
        const close = text.indexOf(')', pos)
        if (close > pos) {
            notes.push(text.slice(pos + 1, close).trim())
            pos = close + 1
            skipSpace()
        }
    }

    const um = matchUnit(text.slice(pos))
    if (um) {
        base.unit = um.unit.id
        base.unitText = um.text
        unitSpan = [pos, pos + um.length]
        pos += um.length
        skipSpace()
        if (text[pos] === '(') {
            const close = text.indexOf(')', pos)
            if (close > pos) {
                equivalentSpan = [pos, close + 1]
                notes.push(text.slice(pos + 1, close).trim())
                pos = close + 1
                skipSpace()
            }
        }
    }
    if (/^of\s/i.test(text.slice(pos)) && (base.unit || base.quantity !== null)) pos += 3

    let name = text.slice(pos)
    name = name.replace(/\(([^)]*)\)/g, (_, inner: string) => {
        if (inner.trim()) notes.push(inner.trim())
        return ' '
    })
    const comma = name.indexOf(',')
    if (comma >= 0) {
        const after = name.slice(comma + 1).trim()
        if (after) notes.push(after)
        name = name.slice(0, comma)
    }
    const toTaste = /\s+(?:to taste|as needed|for serving|for garnish|optional)$/i.exec(name)
    if (toTaste) {
        notes.push(toTaste[0].trim())
        name = name.slice(0, toTaste.index)
    }
    base.name = name.replace(/\s+/g, ' ').trim()
    base.note = notes.length ? notes.join(', ') : null
    return { parsed: base, qtySpan, unitSpan, equivalentSpan, text }
}

export function parseIngredient(line: string): ParsedIngredient {
    return analyze(line).parsed
}

const GLYPHS: Array<[number, string]> = [
    [1 / 8, '⅛'],
    [1 / 6, '⅙'],
    [1 / 5, '⅕'],
    [1 / 4, '¼'],
    [1 / 3, '⅓'],
    [3 / 8, '⅜'],
    [2 / 5, '⅖'],
    [1 / 2, '½'],
    [3 / 5, '⅗'],
    [5 / 8, '⅝'],
    [2 / 3, '⅔'],
    [3 / 4, '¾'],
    [4 / 5, '⅘'],
    [5 / 6, '⅚'],
    [7 / 8, '⅞'],
]
const GLYPH_BY_ASCII = new Map(
    GLYPHS.map(([value, glyph]) => {
        const den = [2, 3, 4, 5, 6, 8].find((d) => Math.abs(Math.round(value * d) - value * d) < 1e-9) ?? 1
        return [`${Math.round(value * den)}/${den}`, glyph] as const
    }),
)

function trimDecimal(n: number, places: number): string {
    return String(Number(n.toFixed(places)))
}

/** 1.5 → '1½', 0.333 → '⅓', 2 → '2', 1.37 → '1.37'. Metric units get decimals. */
export function formatQuantity(n: number, unit?: string | null): string {
    if (!Number.isFinite(n)) return ''
    const def = unitDef(unit ?? null)
    if (def?.metric) {
        if (def.id === 'g' || def.id === 'ml' || def.id === 'mg')
            return n >= 10 ? String(Math.round(n)) : trimDecimal(n, 1)
        return trimDecimal(n, 2)
    }
    if (n >= 20) return String(Math.round(n))
    let whole = Math.floor(n)
    let frac = n - whole
    if (frac > 1 - 1 / 32) {
        whole += 1
        frac = 0
    }
    if (frac < 1 / 32) return String(whole)
    let best: [number, string] | null = null
    for (const [value, glyph] of GLYPHS) {
        const diff = Math.abs(value - frac)
        if (diff <= 0.02 && (!best || diff < Math.abs(best[0] - frac))) best = [value, glyph]
    }
    if (best) return whole ? `${whole}${best[1]}` : best[1]
    return trimDecimal(n, 2)
}

/** Replaces ASCII fractions with vulgar fraction glyphs for display: '1 1/2 cups' → '1½ cups'. */
export function prettifyFractions(text: string): string {
    return normalizeFractions(text).replace(/(?<![\d/])(?:(\d+)\s+)?(\d+)\/(\d+)(?![\d/])/g, (match, whole, a, b) => {
        const glyph = GLYPH_BY_ASCII.get(`${a}/${b}`)
        if (!glyph) return match
        return whole ? `${whole}${glyph}` : glyph
    })
}

function rangeText(min: number, max: number | null, unit: string | null): string {
    const a = formatQuantity(min, unit)
    if (max === null) return a
    return `${a}–${formatQuantity(max, unit)}`
}

function pluralizeUnit(text: string, def: UnitDef, amount: number): string {
    const lower = text.toLowerCase()
    const wantsPlural = amount > 1
    if (lower === def.singular && wantsPlural && def.plural !== def.singular) return matchCase(def.plural, text)
    if (lower === def.plural && !wantsPlural && def.plural !== def.singular) return matchCase(def.singular, text)
    return text
}

function matchCase(word: string, like: string): string {
    return like[0] && like[0] === like[0].toUpperCase() && like[0] !== like[0].toLowerCase()
        ? word[0]?.toUpperCase() + word.slice(1)
        : word
}

const EQUIVALENT =
    /^\((?<qty>\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+)(?:\s*(?:-|–|to)\s*(?<max>\d+(?:\.\d+)?))?\s*(?<rest>[^)]*)\)$/

/**
 * Scales the leading amount (and a '(190 g)' equivalent right after the unit), keeps
 * package sizes like '1 (14 oz) can' fixed, fixes unit plurals, and prints fractions
 * as glyphs. Lines without a leading amount come back cleaned but unscaled.
 */
export function scaleIngredient(line: string, factor: number): string {
    const { parsed, qtySpan, unitSpan, equivalentSpan, text } = analyze(line)
    if (parsed.isHeading || !qtySpan || parsed.quantity === null) return prettifyFractions(text)
    if (!Number.isFinite(factor) || factor <= 0) return prettifyFractions(text)
    if (factor === 1) return prettifyFractions(text)

    const min = parsed.quantity * factor
    const max = parsed.quantityMax === null ? null : parsed.quantityMax * factor
    const pieces: string[] = [rangeText(min, max, parsed.unit)]
    let cursor = qtySpan[1]
    const def = unitDef(parsed.unit)
    if (unitSpan && def) {
        pieces.push(text.slice(cursor, unitSpan[0]))
        pieces.push(pluralizeUnit(text.slice(unitSpan[0], unitSpan[1]), def, max ?? min))
        cursor = unitSpan[1]
    }
    if (equivalentSpan) {
        pieces.push(text.slice(cursor, equivalentSpan[0]))
        const inner = text.slice(equivalentSpan[0], equivalentSpan[1])
        const em = EQUIVALENT.exec(inner)
        const q = em?.groups?.qty ? toNumber(em.groups.qty) : null
        if (em?.groups && q !== null) {
            const restUnit = matchUnit(em.groups.rest ?? '')
            const unitId = restUnit?.unit.id ?? null
            const eqMax = em.groups.max ? toNumber(em.groups.max) : null
            const amount = rangeText(q * factor, eqMax === null ? null : eqMax * factor, unitId)
            const rest = (em.groups.rest ?? '').trim()
            pieces.push(rest ? `(${amount} ${rest})` : `(${amount})`)
        } else {
            pieces.push(inner)
        }
        cursor = equivalentSpan[1]
    }
    pieces.push(text.slice(cursor))
    return prettifyFractions(
        pieces
            .join('')
            .replace(/\s{2,}/g, ' ')
            .trim(),
    )
}

/** Display form at a scale. Kept for older call sites. */
export function formatIngredient(line: string, scale = 1): string {
    return scaleIngredient(line, scale)
}

/** Parses a servings label ('4', '4 to 6', 'Makes 12 cookies') to its first number. */
export function servingsNumber(servings: string | null | undefined): number | null {
    if (!servings) return null
    const m = /(\d+(?:\.\d+)?)/.exec(servings)
    return m ? Number(m[1]) : null
}
