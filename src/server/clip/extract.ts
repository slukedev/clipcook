import { type Cheerio, type CheerioAPI, load } from 'cheerio'
import type { AnyNode, Element } from 'domhandler'
import type { ImportedRecipe } from '@/lib/domain/types'
import { normalizeDurationLabel } from '@/lib/recipe/time'
import { cleanLines, cleanText, decodeEntities, stripTags } from '@/lib/recipe/text'

export type ExtractMethod = 'jsonld' | 'microdata' | 'wprm' | 'tasty' | 'mvcreate' | 'heuristic'

export interface ExtractedRecipe extends Omit<ImportedRecipe, 'image'> {
    /** Absolute URL of the best recipe image, or the page's og:image. Fetched separately. */
    imageUrl?: string
    method: ExtractMethod
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type JsonObject = { [key: string]: Json }

const MAX_TAGS = 8
const MAX_LINES = 300

function isObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray(value: Json | undefined): Json[] {
    if (value === undefined || value === null) return []
    return Array.isArray(value) ? value : [value]
}

/** Matches 'Recipe', 'schema:Recipe', 'https://schema.org/Recipe', and arrays of those. */
function hasType(node: JsonObject, type: string): boolean {
    const want = type.toLowerCase()
    return asArray(node['@type']).some((t) => typeof t === 'string' && t.split(/[/#:]/).pop()?.toLowerCase() === want)
}

function str(value: Json | undefined): string | undefined {
    for (const v of asArray(value)) {
        if (typeof v === 'string' && v.trim()) return v
        if (typeof v === 'number') return String(v)
        if (isObject(v) && typeof v['@value'] === 'string') return v['@value']
    }
    return undefined
}

function parseJsonLd(text: string): Json | null {
    const trimmed = text
        .trim()
        .replace(/^<!--/, '')
        .replace(/-->$/, '')
        .replace(/^\s*\/\*<!\[CDATA\[\*\/|\/\*\]\]>\*\/\s*$/g, '')
        .trim()
    if (!trimmed) return null
    try {
        return JSON.parse(trimmed) as Json
    } catch {
        // Some CMSes leave raw control characters inside strings.
        try {
            return JSON.parse(trimmed.replace(/[\u0000-\u001f]+/g, ' ')) as Json
        } catch {
            return null
        }
    }
}

interface JsonLdIndex {
    nodes: JsonObject[]
    byId: Map<string, JsonObject>
}

function indexJsonLd(roots: Json[]): JsonLdIndex {
    const nodes: JsonObject[] = []
    const byId = new Map<string, JsonObject>()
    const seen = new Set<JsonObject>()
    const visit = (value: Json | undefined, depth: number) => {
        if (depth > 12 || value === undefined || value === null) return
        if (Array.isArray(value)) {
            for (const item of value) visit(item, depth + 1)
            return
        }
        if (!isObject(value) || seen.has(value)) return
        seen.add(value)
        nodes.push(value)
        const id = value['@id']
        if (typeof id === 'string' && Object.keys(value).length > 1) byId.set(id, value)
        for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item', 'hasPart', 'about']) {
            visit(value[key], depth + 1)
        }
    }
    for (const root of roots) visit(root, 0)
    return { nodes, byId }
}

function deref(value: Json | undefined, index: JsonLdIndex): Json | undefined {
    if (isObject(value) && typeof value['@id'] === 'string' && Object.keys(value).length === 1) {
        return index.byId.get(value['@id']) ?? value
    }
    return value
}

function imageFromJson(value: Json | undefined, index: JsonLdIndex): string | undefined {
    let best: { url: string; width: number } | undefined
    for (const raw of asArray(deref(value, index))) {
        const item = deref(raw, index)
        if (typeof item === 'string' && item.trim()) {
            best ??= { url: item.trim(), width: 0 }
        } else if (isObject(item)) {
            const url = str(item.url) ?? str(item.contentUrl)
            const width = Number(str(item.width) ?? 0) || 0
            if (url && (!best || width > best.width)) best = { url, width }
        }
    }
    return best?.url
}

/** Splits an HTML or newline-separated instruction string into steps. */
function splitInstructionText(text: string): string[] {
    const decoded = decodeEntities(text)
    if (/<(li|p|br)\b/i.test(decoded)) {
        return decoded
            .split(/<\/?(?:li|p|ol|ul)\b[^>]*>|<br\s*\/?>/i)
            .map((s) => cleanText(stripTags(s)))
            .filter(Boolean)
    }
    const lines = decoded
        .split(/\r?\n+/)
        .map((s) => cleanText(s))
        .filter(Boolean)
    if (lines.length > 1) return lines.map((l) => l.replace(/^(?:step\s*)?\d{1,2}[.):]\s+/i, ''))
    // One long paragraph written as '1. Do this. 2. Do that.'
    const numbered = (lines[0] ?? '').split(/\s+(?=\d{1,2}[.)]\s+[A-Z])/)
    return numbered.length > 1 ? numbered.map((s) => s.replace(/^\d{1,2}[.)]\s+/, '')) : lines
}

function instructionsFromJson(value: Json | undefined, index: JsonLdIndex): string[] {
    const out: string[] = []
    const visit = (raw: Json | undefined, depth: number) => {
        const node = deref(raw, index)
        if (depth > 8 || node === undefined || node === null) return
        if (typeof node === 'string') {
            out.push(...splitInstructionText(node))
            return
        }
        if (Array.isArray(node)) {
            for (const item of node) visit(item, depth + 1)
            return
        }
        if (!isObject(node)) return
        const children = node.itemListElement ?? (hasType(node, 'HowToSection') ? node.steps : undefined)
        if (children !== undefined && (hasType(node, 'HowToSection') || hasType(node, 'ItemList') || !node.text)) {
            const name = str(node.name)
            if (name && hasType(node, 'HowToSection')) out.push(`# ${cleanText(name)}`)
            visit(children, depth + 1)
            return
        }
        const text = str(node.text) ?? str(node.description) ?? str(node.name)
        if (text) out.push(...splitInstructionText(text))
    }
    visit(value, 0)
    return out
}

function cleanServings(raw: string | undefined): string | undefined {
    if (!raw) return undefined
    let s = cleanText(raw)
        .replace(/^(?:serves|servings?|yields?|makes)\s*:?\s*/i, '')
        .replace(/\s+(?:servings?|people|portions)$/i, '')
        .replace(/^(\d+)\s*(?:-|–)\s*(\d+)$/, '$1 to $2')
    if (s.length > 40) s = s.slice(0, 40).trim()
    return s || undefined
}

function servingsFromJson(value: Json | undefined): string | undefined {
    const values = asArray(value)
        .map((v) => (typeof v === 'number' ? String(v) : typeof v === 'string' ? v : undefined))
        .filter((v): v is string => Boolean(v?.trim()))
    // ['4', '4 servings'] or ['12 cookies']: prefer a bare number or range, else the first.
    const bare = values.find((v) => /^\s*\d+(?:\s*(?:-|–|to)\s*\d+)?\s*$/.test(v))
    return cleanServings(bare ?? values[0])
}

function splitKeywords(values: Array<string | undefined>): string[] {
    return values.flatMap((v) => (v ? v.split(/[,;|]/) : []))
}

const JUNK_TAGS = new Set(['recipe', 'recipes', 'uncategorized', 'main', 'featured', 'all', 'none', 'other', 'default', 'food'])

export function cleanTags(values: string[], exclude: string[] = []): string[] {
    const banned = new Set(exclude.map((e) => e.toLowerCase().trim()).filter(Boolean))
    const out: string[] = []
    for (const raw of values) {
        const tag = cleanText(raw).toLowerCase().replace(/^#/, '').trim()
        if (!tag || tag.length > 30 || /^\d+$/.test(tag) || JUNK_TAGS.has(tag) || banned.has(tag)) continue
        if (/https?:|www\.|\.com\b/.test(tag)) continue
        if (!out.includes(tag)) out.push(tag)
        if (out.length >= MAX_TAGS) break
    }
    return out
}

function recipeFromJsonLd(roots: Json[]): { recipe: ExtractedRecipe; publisher?: string } | null {
    const index = indexJsonLd(roots)
    const candidates = index.nodes.filter((n) => hasType(n, 'Recipe'))
    if (candidates.length === 0) return null
    const score = (n: JsonObject) =>
        asArray(n.recipeIngredient ?? n.ingredients).length * 2 + (n.recipeInstructions ? 1 : 0)
    const node = candidates.toSorted((a, b) => score(b) - score(a))[0] as JsonObject

    const ingredientsRaw = asArray(node.recipeIngredient ?? node.ingredients).flatMap((v) =>
        typeof v === 'string' ? v.split(/\r?\n/) : isObject(v) && typeof v.text === 'string' ? [v.text] : [],
    )
    const recipe: ExtractedRecipe = { method: 'jsonld' }
    const title = str(node.name) ?? str(node.headline)
    if (title) recipe.title = cleanText(title)
    const description = str(node.description)
    if (description) recipe.description = cleanText(description)
    const servings = servingsFromJson(node.recipeYield ?? node.yield)
    if (servings) recipe.servings = servings
    for (const key of ['prepTime', 'cookTime', 'totalTime'] as const) {
        const v = str(node[key])
        if (v) recipe[key] = normalizeDurationLabel(cleanText(v))
    }
    const ingredients = cleanLines(ingredientsRaw).slice(0, MAX_LINES)
    if (ingredients.length) recipe.ingredients = ingredients
    const instructions = dedupeKeepHeadings(instructionsFromJson(node.recipeInstructions, index)).slice(0, MAX_LINES)
    if (instructions.length) recipe.instructions = instructions
    const image = imageFromJson(node.image ?? node.thumbnailUrl, index)
    if (image) recipe.imageUrl = image
    const tags = splitKeywords([
        ...asArray(node.recipeCategory).map((v) => str(v)),
        ...asArray(node.recipeCuisine).map((v) => str(v)),
        ...asArray(node.keywords).map((v) => str(v)),
    ])
    if (tags.length) recipe.tags = tags

    const publisherNode = deref(node.publisher, index)
    let publisher = isObject(publisherNode) ? str(publisherNode.name) : undefined
    if (!publisher) {
        const site = index.nodes.find((n) => hasType(n, 'WebSite') || hasType(n, 'Organization'))
        publisher = site ? str(site.name) : undefined
    }
    return { recipe, publisher: publisher ? cleanText(publisher) : undefined }
}

function dedupeKeepHeadings(lines: string[]): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    for (const line of lines) {
        const clean = line.startsWith('# ') ? `# ${cleanText(line.slice(2))}` : cleanText(line)
        if (!clean || clean === '#') continue
        const key = clean.toLowerCase()
        if (!clean.startsWith('# ') && seen.has(key)) continue
        seen.add(key)
        out.push(clean)
    }
    // A heading with nothing after it is noise.
    return out.filter((line, i) => !line.startsWith('# ') || (out[i + 1] !== undefined && !out[i + 1]?.startsWith('# ')))
}

// ---------- HTML helpers ----------

function text($el: Cheerio<AnyNode>): string {
    return cleanText($el.text())
}

function absoluteUrl(value: string | undefined, base: string): string | undefined {
    if (!value) return undefined
    try {
        const url = new URL(value.trim(), base)
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined
    } catch {
        return undefined
    }
}

function largestFromSrcset(srcset: string | undefined): string | undefined {
    if (!srcset) return undefined
    let best: { url: string; w: number } | undefined
    for (const part of srcset.split(',')) {
        const [url, size] = part.trim().split(/\s+/)
        if (!url) continue
        const w = Number.parseFloat(size ?? '0') || 0
        if (!best || w > best.w) best = { url, w }
    }
    return best?.url
}

function imageFromElement($scope: Cheerio<AnyNode>, base: string): string | undefined {
    const img = $scope.find('img').first()
    if (!img.length) return undefined
    const candidates = [
        largestFromSrcset(img.attr('data-lazy-srcset') ?? img.attr('data-srcset') ?? img.attr('srcset')),
        img.attr('data-lazy-src'),
        img.attr('data-src'),
        img.attr('data-pin-media'),
        img.attr('src'),
    ]
    for (const c of candidates) {
        if (c && !c.startsWith('data:')) return absoluteUrl(c, base)
    }
    return undefined
}

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

/** Walks a container in document order: headings become '# Heading', list items become lines. */
function linesFromContainer($: CheerioAPI, $root: Cheerio<AnyNode>, opts: { paragraphs: boolean; skipFirstHeading?: boolean }): string[] {
    const out: string[] = []
    let skippedHeading = false
    const walk = (nodes: Cheerio<AnyNode>) => {
        nodes.each((_, node) => {
            if (node.type !== 'tag') return
            const el = node as Element
            const tag = el.tagName.toLowerCase()
            const $el = $(el)
            if (tag === 'script' || tag === 'style' || tag === 'button' || tag === 'noscript') return
            if (HEADING_TAGS.has(tag)) {
                const heading = text($el)
                if (opts.skipFirstHeading && !skippedHeading) {
                    skippedHeading = true
                    return
                }
                if (heading) out.push(`# ${heading.replace(/:$/, '')}`)
                return
            }
            if (tag === 'li') {
                const line = text($el)
                if (line) out.push(line)
                return
            }
            if (tag === 'p' && $el.children().length === 1 && $el.children('strong,b').length === 1 && text($el) === text($el.children())) {
                const heading = text($el)
                if (heading.length < 60) out.push(`# ${heading.replace(/:$/, '')}`)
                return
            }
            if (opts.paragraphs && tag === 'p') {
                const line = text($el)
                if (line) out.push(line)
                return
            }
            walk($el.children())
        })
    }
    walk($root.children())
    return out
}

// ---------- Microdata ----------

function microdataValue($: CheerioAPI, el: Element): string {
    const $el = $(el)
    const tag = el.tagName.toLowerCase()
    if (tag === 'meta') return $el.attr('content') ?? ''
    if (tag === 'link' || tag === 'a') return $el.attr('href') ?? $el.text()
    if (tag === 'img') return $el.attr('src') ?? $el.attr('data-src') ?? ''
    if (tag === 'time') return $el.attr('datetime') ?? $el.text()
    if ($el.attr('content')) return $el.attr('content') ?? ''
    return $el.text()
}

function recipeFromMicrodata($: CheerioAPI, base: string): ExtractedRecipe | null {
    const scope = $('[itemscope][itemtype]')
        .filter((_, el) => /schema\.org\/Recipe\b/i.test($(el).attr('itemtype') ?? ''))
        .first()
    if (!scope.length) return null
    const props = (name: string) =>
        scope.find(`[itemprop~="${name}"]`).filter((_, el) => {
            // Skip properties that belong to a nested item other than the recipe.
            const owner = $(el).parent().closest('[itemscope]')
            return owner.length === 0 || owner.get(0) === scope.get(0) || name === 'text'
        })
    const first = (name: string) => {
        const el = props(name).get(0)
        return el ? cleanText(microdataValue($, el as Element)) : undefined
    }
    const recipe: ExtractedRecipe = { method: 'microdata' }
    const title = first('name')
    if (title) recipe.title = title
    const description = first('description')
    if (description) recipe.description = description
    const servings = cleanServings(first('recipeYield') ?? first('yield'))
    if (servings) recipe.servings = servings
    for (const key of ['prepTime', 'cookTime', 'totalTime'] as const) {
        const v = first(key)
        if (v) recipe[key] = normalizeDurationLabel(v)
    }
    const ingredientEls = props('recipeIngredient').length ? props('recipeIngredient') : props('ingredients')
    const ingredients = cleanLines(ingredientEls.toArray().map((el) => microdataValue($, el as Element)))
    if (ingredients.length) recipe.ingredients = ingredients.slice(0, MAX_LINES)
    const instructions: string[] = []
    props('recipeInstructions').each((_, el) => {
        const $el = $(el)
        const stepText = $el.find('[itemprop~="text"]')
        if (stepText.length) {
            stepText.each((__, t) => {
                instructions.push(text($(t)))
            })
            return
        }
        const nested = linesFromContainer($, $el, { paragraphs: true })
        if (nested.length > 1) instructions.push(...nested)
        else instructions.push(...splitInstructionText($el.html() ?? ''))
    })
    const steps = dedupeKeepHeadings(instructions)
    if (steps.length) recipe.instructions = steps.slice(0, MAX_LINES)
    const imageEl = props('image').get(0)
    const image = imageEl ? absoluteUrl(microdataValue($, imageEl as Element), base) : undefined
    if (image) recipe.imageUrl = image
    const tags = splitKeywords(['recipeCategory', 'recipeCuisine', 'keywords'].map((k) => first(k)))
    if (tags.length) recipe.tags = tags
    return recipe.ingredients || recipe.instructions ? recipe : null
}

// ---------- Plugin cards ----------

function recipeFromWprm($: CheerioAPI, base: string): ExtractedRecipe | null {
    const card = $('.wprm-recipe').first()
    if (!card.length) return null
    const recipe: ExtractedRecipe = { method: 'wprm' }
    const title = text(card.find('.wprm-recipe-name').first())
    if (title) recipe.title = title
    const summary = text(card.find('.wprm-recipe-summary').first())
    if (summary) recipe.description = summary
    const servingsEl = card.find('.wprm-recipe-servings').first()
    if (servingsEl.length) {
        const unit = text(card.find('.wprm-recipe-servings-unit').first())
        recipe.servings = cleanServings(`${text(servingsEl)}${unit && !/servings?/i.test(unit) ? ` ${unit}` : ''}`)
    }
    for (const [key, cls] of [
        ['prepTime', 'prep_time'],
        ['cookTime', 'cook_time'],
        ['totalTime', 'total_time'],
    ] as const) {
        const parts = card
            .find(`.wprm-recipe-${cls}`)
            .toArray()
            .map((el) => text($(el)))
            .filter(Boolean)
        if (parts.length) recipe[key] = normalizeDurationLabel(parts.join(' '))
    }
    const ingredients: string[] = []
    card.find('.wprm-recipe-ingredient-group').each((_, group) => {
        const name = text($(group).find('.wprm-recipe-group-name').first())
        if (name) ingredients.push(`# ${name.replace(/:$/, '')}`)
        $(group)
            .find('.wprm-recipe-ingredient')
            .each((__, li) => {
                const $li = $(li)
                const pieces = ['amount', 'unit', 'name']
                    .map((p) => text($li.find(`.wprm-recipe-ingredient-${p}`).first()))
                    .filter(Boolean)
                const notes = text($li.find('.wprm-recipe-ingredient-notes').first())
                const line = pieces.length ? pieces.join(' ') + (notes ? `, ${notes.replace(/^\(|\)$/g, '')}` : '') : text($li)
                if (line) ingredients.push(line)
            })
    })
    const instructions: string[] = []
    card.find('.wprm-recipe-instruction-group').each((_, group) => {
        const name = text($(group).find('.wprm-recipe-group-name').first())
        if (name) instructions.push(`# ${name.replace(/:$/, '')}`)
        $(group)
            .find('.wprm-recipe-instruction')
            .each((__, li) => {
                const $li = $(li)
                const t = $li.find('.wprm-recipe-instruction-text')
                const line = text(t.length ? t : $li)
                if (line) instructions.push(line)
            })
    })
    if (ingredients.length) recipe.ingredients = dedupeKeepHeadings(ingredients)
    if (instructions.length) recipe.instructions = dedupeKeepHeadings(instructions)
    const notes = text(card.find('.wprm-recipe-notes').first())
    if (notes) recipe.notes = notes
    const image = imageFromElement(card.find('.wprm-recipe-image').first(), base)
    if (image) recipe.imageUrl = image
    const tags = splitKeywords(
        ['course', 'cuisine', 'keyword'].map((k) => text(card.find(`.wprm-recipe-${k}`).first()) || undefined),
    )
    if (tags.length) recipe.tags = tags
    return recipe.ingredients || recipe.instructions ? recipe : null
}

interface CardSelectors {
    method: ExtractMethod
    root: string
    title: string
    description: string
    yield: string
    prep: string
    cook: string
    total: string
    ingredients: string
    instructions: string
    notes: string
    image: string
    tags: string[]
}

const TASTY: CardSelectors = {
    method: 'tasty',
    root: '.tasty-recipes',
    title: '.tasty-recipes-title',
    description: '.tasty-recipes-description',
    yield: '.tasty-recipes-yield',
    prep: '.tasty-recipes-prep-time',
    cook: '.tasty-recipes-cook-time',
    total: '.tasty-recipes-total-time',
    ingredients: '.tasty-recipes-ingredients',
    instructions: '.tasty-recipes-instructions',
    notes: '.tasty-recipes-notes',
    image: '.tasty-recipes-image',
    tags: ['.tasty-recipes-category', '.tasty-recipes-cuisine', '.tasty-recipes-keywords'],
}

const MV_CREATE: CardSelectors = {
    method: 'mvcreate',
    root: '.mv-create-card, .mv-create, .mv-recipe-card',
    title: '.mv-create-title',
    description: '.mv-create-description',
    yield: '.mv-create-yield',
    prep: '.mv-create-time-prep .mv-create-time-format',
    cook: '.mv-create-time-active .mv-create-time-format',
    total: '.mv-create-time-total .mv-create-time-format',
    ingredients: '.mv-create-ingredients',
    instructions: '.mv-create-instructions',
    notes: '.mv-create-notes',
    image: '.mv-create-image',
    tags: ['.mv-create-category', '.mv-create-cuisine', '.mv-create-keywords'],
}

function recipeFromCard($: CheerioAPI, base: string, s: CardSelectors): ExtractedRecipe | null {
    const card = $(s.root).first()
    if (!card.length) return null
    const pick = (sel: string) => text(card.find(sel).first())
    const recipe: ExtractedRecipe = { method: s.method }
    const title = pick(s.title)
    if (title) recipe.title = title
    const description = pick(s.description)
    if (description) recipe.description = description
    const servings = cleanServings(pick(s.yield).replace(/^yield:?\s*/i, ''))
    if (servings) recipe.servings = servings
    for (const [key, sel] of [
        ['prepTime', s.prep],
        ['cookTime', s.cook],
        ['totalTime', s.total],
    ] as const) {
        const v = pick(sel).replace(/^(prep|cook|total|active)\s*time:?\s*/i, '')
        if (v) recipe[key] = normalizeDurationLabel(v)
    }
    const ingRoot = card.find(s.ingredients).first()
    const insRoot = card.find(s.instructions).first()
    const ingredients = dedupeKeepHeadings(linesFromContainer($, ingRoot, { paragraphs: false, skipFirstHeading: true }))
    const instructions = dedupeKeepHeadings(linesFromContainer($, insRoot, { paragraphs: true, skipFirstHeading: true }))
    if (ingredients.length) recipe.ingredients = ingredients
    if (instructions.length) recipe.instructions = instructions
    const notesRoot = card.find(s.notes).first()
    if (notesRoot.length) {
        const notes = linesFromContainer($, notesRoot, { paragraphs: true, skipFirstHeading: true })
            .filter((l) => !l.startsWith('# '))
            .join('\n')
        if (notes) recipe.notes = notes
    }
    const image = imageFromElement(card.find(s.image).first(), base)
    if (image) recipe.imageUrl = image
    const tags = splitKeywords(s.tags.map((sel) => pick(sel).replace(/^(category|cuisine|keywords?):?\s*/i, '') || undefined))
    if (tags.length) recipe.tags = tags
    return recipe.ingredients || recipe.instructions ? recipe : null
}

// ---------- Heuristic ----------

const ING_HEADING = /^(?:ingredients?|what you(?:'|’)?ll need|you(?:'|’)?ll need|you will need)\s*:?$/i
const INS_HEADING = /^(?:instructions?|directions?|method|preparation|steps?|how to make(?: it)?)\s*:?$/i

function collectAfterHeading($: CheerioAPI, heading: Element, paragraphs: boolean): string[] {
    const level = HEADING_TAGS.has(heading.tagName.toLowerCase()) ? Number(heading.tagName.slice(1)) : 7
    // The heading may sit alone inside a wrapper; climb until there are siblings to read.
    let anchor: Cheerio<AnyNode> = $(heading)
    for (let i = 0; i < 3 && anchor.nextAll().length === 0; i++) anchor = anchor.parent()
    const out: string[] = []
    let sibling = anchor.next()
    while (sibling.length && out.length < MAX_LINES) {
        const el = sibling.get(0) as Element
        const tag = el.tagName?.toLowerCase() ?? ''
        if (HEADING_TAGS.has(tag)) {
            const t = text(sibling)
            if (Number(tag.slice(1)) <= level || ING_HEADING.test(t) || INS_HEADING.test(t)) break
            out.push(`# ${t.replace(/:$/, '')}`)
        } else if (tag === 'ul' || tag === 'ol') {
            sibling.children('li').each((_, li) => {
                const line = text($(li))
                if (line) out.push(line)
            })
        } else if (tag === 'p' && paragraphs) {
            const line = text(sibling)
            if (ING_HEADING.test(line) || INS_HEADING.test(line)) break
            if (line) out.push(line)
        } else if (tag === 'div' || tag === 'section') {
            const nested = linesFromContainer($, sibling, { paragraphs })
            if (nested.some((l) => ING_HEADING.test(l.replace(/^# /, '')) || INS_HEADING.test(l.replace(/^# /, '')))) break
            out.push(...nested)
        }
        sibling = sibling.next()
    }
    return out
}

function recipeFromHeuristic($: CheerioAPI): ExtractedRecipe | null {
    const headings = $('h1,h2,h3,h4,h5,h6,strong,b').toArray() as Element[]
    let ingredients: string[] = []
    let instructions: string[] = []
    for (const h of headings) {
        const t = text($(h))
        const target = HEADING_TAGS.has(h.tagName.toLowerCase()) ? h : (($(h).closest('p').get(0) as Element | undefined) ?? h)
        if (!ingredients.length && ING_HEADING.test(t)) ingredients = collectAfterHeading($, target, false)
        else if (!instructions.length && INS_HEADING.test(t)) instructions = collectAfterHeading($, target, true)
    }
    ingredients = dedupeKeepHeadings(ingredients)
    instructions = dedupeKeepHeadings(instructions)
    const realIngredients = ingredients.filter((l) => !l.startsWith('# '))
    if (realIngredients.length < 2 && !(realIngredients.length && instructions.length)) return null
    const recipe: ExtractedRecipe = { method: 'heuristic' }
    const title = text($('h1').first())
    if (title) recipe.title = title
    if (ingredients.length) recipe.ingredients = ingredients
    if (instructions.length) recipe.instructions = instructions
    return recipe
}

// ---------- Page metadata ----------

interface PageMeta {
    siteName?: string
    canonical?: string
    ogImage?: string
    ogTitle?: string
    ogDescription?: string
    title?: string
}

function pageMeta($: CheerioAPI, base: string): PageMeta {
    const meta = (selector: string) => {
        const v = $(selector).first().attr('content')
        return v ? cleanText(v) : undefined
    }
    return {
        siteName: meta('meta[property="og:site_name"]') ?? meta('meta[name="application-name"]'),
        canonical: absoluteUrl($('link[rel~="canonical"]').first().attr('href'), base),
        ogImage: absoluteUrl(
            $('meta[property="og:image:secure_url"], meta[property="og:image"], meta[name="og:image"]').first().attr('content') ??
                $('meta[name="twitter:image"], meta[name="twitter:image:src"], meta[property="twitter:image"]')
                    .first()
                    .attr('content'),
            base,
        ),
        ogTitle: meta('meta[property="og:title"]'),
        ogDescription: meta('meta[property="og:description"]') ?? meta('meta[name="description"]'),
        title: cleanText($('title').first().text()) || undefined,
    }
}

export function hostLabel(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\d?\./, '')
    } catch {
        return ''
    }
}

function sameSite(a: string, b: string): boolean {
    const ha = hostLabel(a)
    const hb = hostLabel(b)
    return Boolean(ha) && (ha === hb || ha.endsWith(`.${hb}`) || hb.endsWith(`.${ha}`))
}

const MERGEABLE: Array<keyof ExtractedRecipe> = [
    'title',
    'description',
    'servings',
    'prepTime',
    'cookTime',
    'totalTime',
    'imageUrl',
    'notes',
    'tags',
]

function contentCount(lines: string[] | undefined): number {
    return lines?.filter((l) => !l.startsWith('# ')).length ?? 0
}

function hasHeadings(lines: string[] | undefined): boolean {
    return Boolean(lines?.some((l) => l.startsWith('# ')))
}

/**
 * The best recipe on a page. Sources are tried in order of reliability (JSON-LD,
 * microdata, plugin cards, headings); later sources only fill gaps, except that a
 * plugin card's grouped ingredient or step lists replace flat JSON-LD lists of the
 * same length so section headings survive.
 */
export function extractRecipe(html: string, pageUrl: string, extraJsonLd: string[] = []): ExtractedRecipe | null {
    const $ = load(html)
    const roots: Json[] = []
    for (const raw of extraJsonLd) {
        const parsed = parseJsonLd(raw)
        if (parsed !== null) roots.push(parsed)
    }
    $('script[type*="ld+json" i]').each((_, el) => {
        const parsed = parseJsonLd($(el).text())
        if (parsed !== null) roots.push(parsed)
    })

    const meta = pageMeta($, pageUrl)
    const fromJson = recipeFromJsonLd(roots)
    const sources = [
        fromJson?.recipe ?? null,
        recipeFromMicrodata($, pageUrl),
        recipeFromWprm($, pageUrl),
        recipeFromCard($, pageUrl, TASTY),
        recipeFromCard($, pageUrl, MV_CREATE),
    ].filter((r): r is ExtractedRecipe => r !== null && (Boolean(r.ingredients?.length) || Boolean(r.instructions?.length)))
    if (sources.length === 0) {
        const heuristic = recipeFromHeuristic($)
        if (heuristic) sources.push(heuristic)
    }
    const [primary, ...rest] = sources
    if (!primary) return null

    const recipe: ExtractedRecipe = { ...primary }
    for (const other of rest) {
        for (const key of MERGEABLE) {
            if (recipe[key] === undefined && other[key] !== undefined) {
                ;(recipe as unknown as Record<string, unknown>)[key] = other[key]
            }
        }
        for (const key of ['ingredients', 'instructions'] as const) {
            const mine = recipe[key]
            const theirs = other[key]
            if (!theirs?.length) continue
            if (!mine?.length) recipe[key] = theirs
            else if (!hasHeadings(mine) && hasHeadings(theirs) && contentCount(theirs) >= contentCount(mine)) {
                recipe[key] = theirs
            }
        }
    }

    recipe.title ??= meta.ogTitle ?? meta.title
    if (!recipe.description && meta.ogDescription && recipe.method === 'heuristic') recipe.description = meta.ogDescription
    if (!recipe.imageUrl && meta.ogImage) recipe.imageUrl = meta.ogImage
    if (recipe.imageUrl) recipe.imageUrl = absoluteUrl(recipe.imageUrl, pageUrl)
    if (!recipe.imageUrl) delete recipe.imageUrl

    recipe.sourceUrl = meta.canonical && sameSite(meta.canonical, pageUrl) ? meta.canonical : pageUrl
    recipe.sourceName = meta.siteName ?? fromJson?.publisher ?? hostLabel(pageUrl)
    if (!recipe.sourceName) delete recipe.sourceName

    const tags = cleanTags(recipe.tags ?? [], [recipe.sourceName ?? '', hostLabel(pageUrl), recipe.title ?? ''])
    if (tags.length) recipe.tags = tags
    else delete recipe.tags
    return recipe
}
