// Recipe content shaped for display: ingredient sections at a scale, numbered steps under
// their headings, and which ingredients a step mentions. Pure and client-safe.

import type { ShapeName } from '@/components/ui/shape/shape-paths'
import { parseIngredient, scaleIngredient } from '@/lib/recipe/ingredients'
import { headingText, isHeadingLine } from '@/lib/recipe/text'

export interface IngredientItem {
    /** Index into `recipe.ingredients`. */
    index: number
    /** The full scaled line. */
    text: string
    /** Leading amount and unit ('1½ cups'), or '' when the line has none. */
    amount: string
    /** Everything after the amount. */
    rest: string
}

export interface IngredientSection {
    heading: string | null
    items: IngredientItem[]
}

const AMOUNT = /^[\d\s.,/¼-¾⅐-⅞–-]+/

/** Splits '1½ cups flour' into '1½ cups' and 'flour' so the amount can be set in tabular figures. */
export function splitAmount(line: string): { amount: string; rest: string } {
    const parsed = parseIngredient(line)
    const lead = parsed.quantity === null ? null : AMOUNT.exec(line)
    if (!lead) return { amount: '', rest: line }
    let end = lead[0].trimEnd().length
    const after = line.slice(lead[0].length)
    if (parsed.unitText && after.toLowerCase().startsWith(parsed.unitText.toLowerCase())) {
        end = lead[0].length + parsed.unitText.length
    }
    return { amount: line.slice(0, end).trim(), rest: line.slice(end).trim() }
}

export function ingredientSections(lines: readonly string[], scale: number): IngredientSection[] {
    const sections: IngredientSection[] = []
    let current: IngredientSection = { heading: null, items: [] }
    lines.forEach((line, index) => {
        if (isHeadingLine(line)) {
            if (current.items.length || current.heading) sections.push(current)
            current = { heading: headingText(line), items: [] }
            return
        }
        const text = scaleIngredient(line, scale)
        current.items.push({ index, text, ...splitAmount(text) })
    })
    if (current.items.length || current.heading) sections.push(current)
    return sections
}

/** Scaled ingredient lines without headings, for the grocery list and sharing. */
export function scaledLines(lines: readonly string[], scale: number): { index: number; text: string }[] {
    return lines.flatMap((line, index) => (isHeadingLine(line) ? [] : [{ index, text: scaleIngredient(line, scale) }]))
}

export interface Step {
    /** Zero-based among steps (headings excluded); the number shown is index + 1. */
    index: number
    text: string
    /** The section heading the step sits under, if any. */
    section: string | null
}

export interface StepSection {
    heading: string | null
    steps: Step[]
}

export function stepSections(instructions: readonly string[]): StepSection[] {
    const sections: StepSection[] = []
    let current: StepSection = { heading: null, steps: [] }
    let index = 0
    for (const line of instructions) {
        if (isHeadingLine(line)) {
            if (current.steps.length || current.heading) sections.push(current)
            current = { heading: headingText(line), steps: [] }
            continue
        }
        const text = line.trim()
        if (!text) continue
        current.steps.push({ index: index++, text, section: current.heading })
    }
    if (current.steps.length || current.heading) sections.push(current)
    return sections
}

export function flatSteps(instructions: readonly string[]): Step[] {
    return stepSections(instructions).flatMap((s) => s.steps)
}

// The step numbers cycle through these so neighbors never share a silhouette.
const STEP_SHAPES: ShapeName[] = [
    'cookie9',
    'clover4',
    'sunny',
    'cookie6',
    'pentagon',
    'soft-burst',
    'gem',
    'flower',
    'cookie12',
    'puffy-diamond',
]

export function stepShape(index: number): ShapeName {
    return STEP_SHAPES[index % STEP_SHAPES.length] ?? 'cookie9'
}

const STOP = new Set([
    'and',
    'or',
    'of',
    'the',
    'for',
    'with',
    'fresh',
    'large',
    'small',
    'medium',
    'whole',
    'chopped',
    'minced',
    'sliced',
    'diced',
    'grated',
    'ground',
    'peeled',
    'packed',
    'finely',
    'thinly',
    'roughly',
    'extra-virgin',
    'kosher',
    'plus',
    'more',
    'serving',
    'room',
    'temperature',
    'unsalted',
    'salted',
    'toasted',
    'dried',
    'boneless',
    'skinless',
    'divided',
])

function stem(word: string): string {
    if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`
    if (word.endsWith('oes') && word.length > 4) return word.slice(0, -2)
    if (word.endsWith('es') && /(?:ch|sh|ss|x)es$/.test(word)) return word.slice(0, -2)
    if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1)
    return word
}

function words(text: string): string[] {
    return text
        .toLowerCase()
        .split(/[^a-zÀ-ɏ-]+/)
        .filter(Boolean)
        .map(stem)
}

// The part or form of an ingredient: the word before it names the ingredient too
// ('chicken thighs', 'garlic cloves', 'lemon juice').
const PART = new Set([
    'thigh',
    'breast',
    'leg',
    'wing',
    'drumstick',
    'fillet',
    'filet',
    'loin',
    'chop',
    'shoulder',
    'clove',
    'stalk',
    'sprig',
    'leave',
    'bulb',
    'juice',
    'zest',
    'piece',
    'floret',
    'kernel',
    'strip',
    'slice',
    'wedge',
    'stick',
])

function keyWords(text: string): string[] {
    return words(text).filter((w) => w.length > 2 && !STOP.has(w))
}

interface IngredientName {
    /** Words that alone name it: the head noun, plus the word before a part ('chicken' thighs). */
    keys: string[]
    /** The other naming words ('bell' in bell pepper), used to tell same-head ingredients apart. */
    modifiers: string[]
    /** The word right before the head, which steps often use alone ('cayenne', 'paprika'). */
    lead: string | null
}

/**
 * The names in an ingredient line: 'extra-virgin olive oil' is keyed by 'oil', 'chicken
 * thighs' by 'thigh' and 'chicken', 'salt and pepper' gives two names. Only the first comma
 * segment that names something counts; later ones are prep notes ('cut into pieces').
 */
function ingredientNames(line: string): IngredientName[] {
    const parsed = parseIngredient(line)
    // The parser stops the name at the first comma, so 'boneless, skinless chicken' needs its note.
    const name = `${parsed.name},${parsed.note ?? ''}`.replace(/\(.*?\)/g, ' ')
    const segment = name.split(',').find((part) => keyWords(part).length > 0) ?? ''
    const names: IngredientName[] = []
    for (const part of segment.split(/\s+(?:and|or|&)\s+/i)) {
        const ws = keyWords(part)
        const head = ws[ws.length - 1]
        if (!head) continue
        const before = ws[ws.length - 2]
        const keys = before && PART.has(head) ? [head, before] : [head]
        const modifiers = ws.filter((w) => !keys.includes(w))
        names.push({ keys, modifiers, lead: keys.length === 1 && before ? before : null })
    }
    return names
}

/** A plain-text version for sharing and copying. */
export function recipeText(
    recipe: {
        title: string
        servings: string
        ingredients: readonly string[]
        instructions: readonly string[]
        notes: string
        sourceUrl: string | null
    },
    scale: number,
): string {
    const out: string[] = [recipe.title]
    if (recipe.servings && scale === 1) out.push(`Serves ${recipe.servings}`)
    out.push('', 'Ingredients')
    for (const section of ingredientSections(recipe.ingredients, scale)) {
        if (section.heading) out.push('', section.heading)
        for (const item of section.items) out.push(`- ${item.text}`)
    }
    out.push('', 'Steps')
    for (const section of stepSections(recipe.instructions)) {
        if (section.heading) out.push('', section.heading)
        for (const step of section.steps) out.push(`${step.index + 1}. ${step.text}`)
    }
    if (recipe.notes.trim()) out.push('', 'Notes', recipe.notes.trim())
    if (recipe.sourceUrl) out.push('', recipe.sourceUrl)
    return out.join('\n')
}

/**
 * Indices of the ingredients a step mentions. A match is the head noun of the ingredient
 * name ('oil' for olive oil, 'egg' for 'large eggs'), or the name before a part ('chicken'
 * for chicken thighs), appearing in the step. When several ingredients share the matched
 * word, the ones whose other words are in the step win: 'bell pepper' picks the bell
 * pepper, not the cayenne.
 */
export function mentionedIngredients(step: string, lines: readonly string[]): number[] {
    const stepWords = new Set(words(step))
    const hits: { index: number; key: string; specific: boolean }[] = []
    lines.forEach((line, index) => {
        if (isHeadingLine(line)) return
        let best: { key: string; specific: boolean } | null = null
        for (const name of ingredientNames(line)) {
            const key = name.keys.find((k) => stepWords.has(k))
            if (!key) continue
            const specific = name.modifiers.some((m) => stepWords.has(m))
            if (!best || (specific && !best.specific)) best = { key, specific }
        }
        if (best) hits.push({ index, ...best })
    })
    const specificKeys = new Set(hits.filter((h) => h.specific).map((h) => h.key))
    const out = hits.filter((h) => h.specific || !specificKeys.has(h.key)).map((h) => h.index)
    // 'Add the cayenne' names cayenne pepper by its lead word, unless that word is another
    // ingredient's own name ('chicken' in chicken broth when there are chicken thighs).
    const keys = new Set(hits.map((h) => h.key))
    lines.forEach((line, index) => {
        if (isHeadingLine(line) || out.includes(index)) return
        if (ingredientNames(line).some((n) => n.lead && stepWords.has(n.lead) && !keys.has(n.lead))) out.push(index)
    })
    return out.sort((a, b) => a - b)
}
