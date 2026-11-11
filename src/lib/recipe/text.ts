// Text cleanup shared by the clipper, text import, and display. Client-safe.

const NAMED_ENTITIES: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ensp: ' ',
    emsp: ' ',
    thinsp: ' ',
    ndash: '–',
    mdash: '\u2014',
    minus: '−',
    hellip: '…',
    lsquo: '‘',
    rsquo: '’',
    sbquo: '‚',
    ldquo: '“',
    rdquo: '”',
    bdquo: '„',
    laquo: '«',
    raquo: '»',
    deg: '°',
    frac12: '½',
    frac14: '¼',
    frac34: '¾',
    frac13: '⅓',
    frac23: '⅔',
    frac15: '⅕',
    frac16: '⅙',
    frac18: '⅛',
    frac38: '⅜',
    frac58: '⅝',
    frac78: '⅞',
    frasl: '⁄',
    times: '×',
    divide: '÷',
    middot: '·',
    bull: '•',
    copy: '©',
    reg: '®',
    trade: '™',
    eacute: 'é',
    egrave: 'è',
    ecirc: 'ê',
    euml: 'ë',
    aacute: 'á',
    agrave: 'à',
    acirc: 'â',
    auml: 'ä',
    aring: 'å',
    atilde: 'ã',
    iacute: 'í',
    igrave: 'ì',
    icirc: 'î',
    iuml: 'ï',
    oacute: 'ó',
    ograve: 'ò',
    ocirc: 'ô',
    ouml: 'ö',
    otilde: 'õ',
    oslash: 'ø',
    uacute: 'ú',
    ugrave: 'ù',
    ucirc: 'û',
    uuml: 'ü',
    ntilde: 'ñ',
    ccedil: 'ç',
    szlig: 'ß',
    aelig: 'æ',
    oelig: 'œ',
    Eacute: 'É',
    Agrave: 'À',
    Ccedil: 'Ç',
    Ntilde: 'Ñ',
    Ouml: 'Ö',
    Uuml: 'Ü',
    Auml: 'Ä',
    shy: '',
    zwj: '',
    zwnj: '',
}

const ENTITY = /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);?/gi

function decodeOnce(text: string): string {
    return text.replace(ENTITY, (match, body: string) => {
        if (body[0] === '#') {
            const hex = body[1] === 'x' || body[1] === 'X'
            const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10)
            if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match
            return String.fromCodePoint(code)
        }
        // Without a trailing semicolon only decode the common ones, so 'R&D' and URLs survive.
        if (!match.endsWith(';') && !/^(amp|lt|gt|quot|nbsp)$/i.test(body)) return match
        return NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()] ?? match
    })
}

/** Decodes HTML entities, including the double-encoded '&amp;#39;' many CMSes emit. */
export function decodeEntities(text: string): string {
    let current = text
    for (let i = 0; i < 3 && current.includes('&'); i++) {
        const next = decodeOnce(current)
        if (next === current) break
        current = next
    }
    return current
}

const BLOCK_TAGS = /<\/?(p|div|br|li|ul|ol|h[1-6]|tr|td|section|article)\b[^>]*>/gi

export function stripTags(html: string): string {
    return html
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(BLOCK_TAGS, ' ')
        .replace(/<[^>]*>/g, '')
}

const VULGAR: Record<string, string> = {
    '½': '1/2',
    '⅓': '1/3',
    '⅔': '2/3',
    '¼': '1/4',
    '¾': '3/4',
    '⅕': '1/5',
    '⅖': '2/5',
    '⅗': '3/5',
    '⅘': '4/5',
    '⅙': '1/6',
    '⅚': '5/6',
    '⅐': '1/7',
    '⅛': '1/8',
    '⅜': '3/8',
    '⅝': '5/8',
    '⅞': '7/8',
    '⅑': '1/9',
    '⅒': '1/10',
}

export const VULGAR_FRACTION_CHARS = Object.keys(VULGAR).join('')
const VULGAR_RE = new RegExp(`(?:(\\d)\\s*)?([${VULGAR_FRACTION_CHARS}])`, 'g')

/** '1½' and '1 ½' become '1 1/2'; the fraction slash becomes '/'. Storage form is plain ASCII. */
export function normalizeFractions(text: string): string {
    return text
        .replace(/(\d)\s*[⁄∕]\s*(\d)/g, '$1/$2')
        .replace(VULGAR_RE, (_, whole: string | undefined, frac: string) =>
            whole ? `${whole} ${VULGAR[frac]}` : (VULGAR[frac] ?? frac),
        )
}

/** Collapses whitespace (including nbsp and zero-width characters) and trims. */
export function collapseWhitespace(text: string): string {
    return text
        .replace(/[​-‍﻿]/g, '')
        .replace(/[\s  -   　]+/g, ' ')
        .trim()
}

/** Full cleanup for one clipped string: tags, entities, fractions, whitespace. */
export function cleanText(value: string): string {
    return collapseWhitespace(normalizeFractions(decodeEntities(stripTags(decodeEntities(value)))))
}

/** Cleans every line, drops empties and exact (case-insensitive) duplicates, keeps order. */
export function cleanLines(values: Iterable<string>): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    for (const value of values) {
        const clean = cleanText(value)
        if (!clean) continue
        const key = clean.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(clean)
    }
    return out
}

export function isHeadingLine(line: string): boolean {
    return line.startsWith('# ')
}

export function headingText(line: string): string {
    return line.slice(2).trim()
}
