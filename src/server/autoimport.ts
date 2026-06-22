import 'server-only'

import { load } from 'cheerio'
import Fraction from 'fraction.js'
import parseIsoDuration from 'parse-iso-duration'
import dns from 'node:dns'
import net from 'node:net'
import { Agent, fetch as undiciFetch } from 'undici'

const MAX_HTML_BYTES = 2 * 1024 * 1024 // 2 MB
const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // 4 MB
const FETCH_TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 5
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
const BROWSER_USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function isPrivateAddress(address: string): boolean {
    if (net.isIPv4(address)) {
        const [a, b] = address.split('.').map(Number) as [number, number]
        if (a === 10) return true
        if (a === 127) return true
        if (a === 0) return true
        if (a === 169 && b === 254) return true
        if (a === 172 && b >= 16 && b <= 31) return true
        if (a === 192 && b === 168) return true
        if (a >= 224) return true // multicast/reserved
        return false
    }
    if (net.isIPv6(address)) {
        const lower = address.toLowerCase()
        if (lower === '::1' || lower === '::') return true
        if (lower.startsWith('fc') || lower.startsWith('fd')) return true
        if (lower.startsWith('fe80')) return true
        if (lower.startsWith('::ffff:')) {
            const v4 = lower.slice(7)
            if (net.isIPv4(v4)) return isPrivateAddress(v4)
        }
        return false
    }
    return true
}

function stripBrackets(host: string): string {
    return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
}

function assertLiteralPublic(hostname: string): void {
    const bare = stripBrackets(hostname)
    if (!bare || bare === 'localhost') throw new Error('Blocked: private host')
    if (net.isIP(bare) && isPrivateAddress(bare)) throw new Error('Blocked: private IP')
}

// Undici dispatcher that validates the resolved IP at connect-time. This closes the
// TOCTOU gap between a pre-fetch DNS check and the socket the request actually uses
// (DNS rebinding). Any lookup that returns a private/reserved address is rejected
// before the TCP connection is established.
const safeDispatcher = new Agent({
    connect: {
        lookup(hostname, options, callback) {
            // Force single-result lookup so we can validate the address undici is
            // actually about to dial. If we asked for `all: true` undici would pick
            // one; by narrowing here we know the address we check is the address used.
            const opts = { ...options, all: false as const, verbatim: false }
            dns.lookup(hostname, opts, (err, address, family) => {
                if (err) return callback(err, '', 0)
                if (!address || isPrivateAddress(address)) {
                    return callback(new Error('Blocked: private IP via DNS'), '', 0)
                }
                callback(null, address, family)
            })
        },
    },
})

async function safeFetch(url: string, maxBytes: number, accept?: string): Promise<{
    body: ArrayBuffer
    contentType: string | null
    finalUrl: string
}> {
    const startedAt = Date.now()
    let current = url
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const parsed = new URL(current)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('Only http(s) is allowed')
        }
        assertLiteralPublic(parsed.hostname)

        const remaining = FETCH_TIMEOUT_MS - (Date.now() - startedAt)
        if (remaining <= 0) throw new Error('Upstream timed out')

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), remaining)
        let res: Awaited<ReturnType<typeof undiciFetch>>
        try {
            res = await undiciFetch(parsed.toString(), {
                method: 'GET',
                redirect: 'manual',
                signal: controller.signal,
                dispatcher: safeDispatcher,
                headers: {
                    'User-Agent': BROWSER_USER_AGENT,
                    'Accept-Language': 'en-US,en;q=0.9',
                    ...(accept ? { Accept: accept } : {}),
                },
            })
        } finally {
            clearTimeout(timer)
        }

        if (res.status >= 300 && res.status < 400) {
            const location = res.headers.get('location')
            if (!location) throw new Error(`Upstream redirected without a Location header`)
            current = new URL(location, parsed).toString()
            continue
        }

        if (res.status === 403 || res.status === 401) {
            throw new Error('Site blocked the request (anti-scraping)')
        }
        if (res.status === 404) throw new Error('Page not found (404)')
        if (res.status === 429) throw new Error('Site rate-limited the request (429)')
        if (!res.ok) throw new Error(`Upstream responded ${res.status}`)

        const lenHeader = res.headers.get('content-length')
        if (lenHeader && Number(lenHeader) > maxBytes) throw new Error('Upstream payload too large')

        const reader = res.body?.getReader()
        if (!reader) throw new Error('Empty response')
        const chunks: Uint8Array[] = []
        let total = 0
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) {
                total += value.byteLength
                if (total > maxBytes) {
                    await reader.cancel()
                    throw new Error('Upstream payload too large')
                }
                chunks.push(value)
            }
        }
        const buf = new Uint8Array(total)
        let offset = 0
        for (const c of chunks) {
            buf.set(c, offset)
            offset += c.byteLength
        }
        return {
            body: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
            contentType: res.headers.get('content-type'),
            finalUrl: parsed.toString(),
        }
    }
    throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`)
}

function formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const parts: string[] = []
    if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
    if (minutes) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`)
    if (seconds) parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`)
    return parts.join(', ') || '0 seconds'
}

function simplifyFractionsInText(text: string): string {
    return text.replace(/-?\d+(?:\.\d+)?/g, (match) => {
        try {
            return new Fraction(match).simplify(0.001).toFraction(true)
        } catch {
            return match
        }
    })
}

function firstOfType<T>(node: unknown, predicate: (n: unknown) => n is T): T | null {
    if (Array.isArray(node)) {
        for (const item of node) {
            const found = firstOfType(item, predicate)
            if (found) return found
        }
        return null
    }
    if (node && typeof node === 'object') {
        const graph = (node as { '@graph'?: unknown[] })['@graph']
        if (Array.isArray(graph)) {
            for (const item of graph) {
                const found = firstOfType(item, predicate)
                if (found) return found
            }
        }
    }
    return predicate(node) ? node : null
}

interface RawRecipe {
    '@type'?: string | string[]
    name?: string
    headline?: string
    description?: string
    image?: string | string[] | { url?: string }
    recipeYield?: string | string[] | number
    prepTime?: string
    cookTime?: string
    totalTime?: string
    recipeIngredient?: string[]
    recipeInstructions?: Array<string | { text?: string; name?: string }>
}

// Schema.org `@type` may be a bare token (`Recipe`), a full URL
// (`https://schema.org/Recipe`), or an array mixing several types. Normalise to the
// trailing token and compare case-insensitively so all of those forms match.
function typeMatches(type: unknown, target: string): boolean {
    const want = target.toLowerCase()
    const test = (t: unknown): boolean => {
        if (typeof t !== 'string') return false
        const token = t.split(/[/#]/).pop()?.toLowerCase()
        return token === want
    }
    if (Array.isArray(type)) return type.some(test)
    return test(type)
}

function isRecipeNode(n: unknown): n is RawRecipe {
    if (!n || typeof n !== 'object') return false
    return typeMatches((n as { '@type'?: unknown })['@type'], 'Recipe')
}

function stringOrFirst(value: unknown): string | undefined {
    if (typeof value === 'string') return value
    if (Array.isArray(value)) {
        for (const v of value) {
            if (typeof v === 'string') return v
        }
    }
    return undefined
}

function extractImageUrl(image: RawRecipe['image']): string | undefined {
    if (!image) return undefined
    if (typeof image === 'string') return image
    if (Array.isArray(image)) {
        for (const item of image) {
            if (typeof item === 'string') return item
            if (item && typeof item === 'object' && 'url' in item) {
                const u = (item as { url?: string }).url
                if (u) return u
            }
        }
        return undefined
    }
    if (typeof image === 'object' && 'url' in image) return image.url
    return undefined
}

function parseIsoToHuman(iso: string | undefined): string | undefined {
    if (!iso) return undefined
    try {
        return formatDuration(parseIsoDuration(iso))
    } catch {
        return undefined
    }
}

function extractInstructions(raw: RawRecipe['recipeInstructions']): string[] {
    if (!raw) return []
    const out: string[] = []
    const push = (value: string) => {
        const clean = stripHtml(value)
        if (clean) out.push(clean)
    }
    const visit = (node: unknown) => {
        if (typeof node === 'string') {
            push(node)
            return
        }
        if (!node || typeof node !== 'object') return
        if (Array.isArray(node)) {
            for (const item of node) visit(item)
            return
        }
        const obj = node as { text?: unknown; name?: unknown; itemListElement?: unknown }
        if (Array.isArray(obj.itemListElement)) {
            visit(obj.itemListElement)
            return
        }
        if (typeof obj.text === 'string' && obj.text.trim()) push(obj.text)
        else if (typeof obj.name === 'string' && obj.name.trim()) push(obj.name)
    }
    visit(raw)
    return out
}

function extractServings(raw: RawRecipe['recipeYield']): string | undefined {
    const toText = (v: unknown): string | undefined => {
        if (typeof v === 'number') return String(v)
        if (typeof v === 'string') return v
        return undefined
    }
    let text: string | undefined
    if (Array.isArray(raw)) {
        for (const v of raw) {
            text = toText(v)
            if (text) break
        }
    } else {
        text = toText(raw)
    }
    if (!text) return undefined
    text = text.trim()
    if (!text) return undefined
    // recipeYield is frequently free text ("Serves 4", "4 servings", "4 to 6"). The
    // editor's servings field and the scaling UI both expect a plain number, so prefer
    // the first integer when there is one and fall back to the raw text otherwise.
    const match = /\d+/.exec(text)
    return match ? match[0] : text.slice(0, 20)
}

// JSON-LD recipe fields sometimes embed HTML (links, <p>, &nbsp;). Strip tags so the
// stored value is clean text; entity decoding is handled later in the recipe view.
function stripHtml(value: string): string {
    return value
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

export interface ImportedRecipe {
    image?: string
    title?: string
    description?: string
    servings?: string
    prepTime?: string
    cookTime?: string
    totalTime?: string
    ingredients?: string[]
    instructions?: string[]
}

export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
    const { body, contentType } = await safeFetch(url, MAX_HTML_BYTES, 'text/html,application/xhtml+xml')
    if (contentType && !contentType.toLowerCase().includes('html')) {
        throw new Error('Target URL is not an HTML page')
    }
    const html = new TextDecoder('utf-8', { fatal: false }).decode(body)
    const $ = load(html)

    // Pages routinely emit several JSON-LD blocks (e.g. an Organization or WebSite
    // graph first, the Recipe later) — and a single block may itself be an array or an
    // `@graph`. Collect every block and let `firstOfType` walk all of them so we don't
    // miss a recipe that isn't in the first script tag.
    const roots: unknown[] = []
    $('script[type*="ld+json" i]').each((_, el) => {
        const raw = $(el).contents().text().trim()
        if (!raw) return
        try {
            roots.push(JSON.parse(raw))
        } catch {
            // skip invalid JSON-LD block
        }
    })
    if (roots.length === 0) throw new Error('No recipe metadata found on page')

    const recipe = firstOfType(roots, isRecipeNode)
    if (!recipe) throw new Error('No recipe metadata found on page')

    const out: ImportedRecipe = {}

    const titleRaw = stringOrFirst(recipe.name) ?? stringOrFirst(recipe.headline)
    const title = titleRaw ? stripHtml(titleRaw) : undefined
    if (title) out.title = title

    const descriptionRaw = stringOrFirst(recipe.description)
    const description = descriptionRaw ? stripHtml(descriptionRaw) : undefined
    if (description) out.description = description

    const servings = extractServings(recipe.recipeYield)
    if (servings) out.servings = servings

    const prep = parseIsoToHuman(recipe.prepTime)
    if (prep) out.prepTime = prep
    const cook = parseIsoToHuman(recipe.cookTime)
    if (cook) out.cookTime = cook
    const total = parseIsoToHuman(recipe.totalTime)
    if (total) out.totalTime = total

    if (Array.isArray(recipe.recipeIngredient)) {
        out.ingredients = recipe.recipeIngredient
            .filter((s): s is string => typeof s === 'string')
            .map((s) => simplifyFractionsInText(stripHtml(s)))
            .filter((s) => s.length > 0)
    }

    const instructions = extractInstructions(recipe.recipeInstructions)
    if (instructions.length > 0) out.instructions = instructions

    const imageUrl = extractImageUrl(recipe.image)
    if (imageUrl) {
        try {
            const img = await safeFetch(imageUrl, MAX_IMAGE_BYTES, 'image/*')
            const type = (img.contentType || '').split(';')[0]?.trim().toLowerCase() ?? ''
            if (ALLOWED_IMAGE_TYPES.has(type)) {
                const b64 = Buffer.from(img.body).toString('base64')
                out.image = `data:${type};base64,${b64}`
            }
        } catch {
            // image optional
        }
    }

    return out
}
