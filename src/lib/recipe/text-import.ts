// Pasted free text → ImportedRecipe. Client-safe.

import type { ImportedRecipe } from '@/lib/domain/types'
import { cleanText, collapseWhitespace } from './text'
import { normalizeDurationLabel } from './time'

type Section = 'intro' | 'ingredients' | 'instructions' | 'notes'

const INGREDIENT_HEADER =
    /^(?:ingredients?|ingredient list|what you(?:'|’)?ll need|you(?:'|’)?ll need|you will need|shopping list)\s*:?$/i
const INSTRUCTION_HEADER =
    /^(?:instructions?|directions?|method|preparation|prep(?:aration)? steps|steps?|how to make(?: it)?|procedure|to make)\s*:?$/i
const NOTES_HEADER = /^(?:notes?|tips?|cook(?:'|’)?s notes?|recipe notes?|variations?)\s*:?$/i

const BULLET = /^\s*(?:[-*•·▪◦‣⁃○●□■▢☐✓✔]|•)\s*/
const NUMBERED = /^\s*(?:step\s*)?(\d{1,2})\s*[.):]\s*|^\s*step\s+(\d{1,2})\s*[-:.]?\s*/i
const URL_LINE = /^https?:\/\/\S+$/i

type MetaKey = 'servings' | 'prepTime' | 'cookTime' | 'totalTime'

// A time label either follows a colon ('Prep: 10 min') or starts with a number ('Prep 10 min'),
// so 'Cook the onions until soft' stays prose.
const TIME_VALUE = String.raw`(?::\s*|\s+(?=(?:\d|[½⅓⅔¼¾]|about|approx|around|under|an?\s+hour|half|one|two|three|four|five|ten|fifteen|twenty|thirty|forty|sixty|ninety)))(.+)`
const META: Array<[RegExp, MetaKey]> = [
    [/^(?:serves|servings|serving size|yield|yields|makes)\s*:?\s*(.+)$/i, 'servings'],
    [new RegExp(`^(?:prep(?:aration)?(?: time)?)${TIME_VALUE}$`, 'i'), 'prepTime'],
    [new RegExp(`^(?:cook(?:ing)?(?: time)?|bake time|baking time|bake)${TIME_VALUE}$`, 'i'), 'cookTime'],
    [new RegExp(`^(?:total(?: time)?|ready in)${TIME_VALUE}$`, 'i'), 'totalTime'],
]

const SERVINGS_VALUE =
    /^(?:about\s+|approx(?:imately|\.)?\s+|up to\s+)?(?:\d|[½⅓⅔¼¾]|one|two|three|four|five|six|seven|eight|nine|ten|twelve|a dozen)/i
const DURATION_VALUE = /\d|hour|minute|\bmin|\bhr/i
const MAX_SERVINGS_LENGTH = 24

/** One header piece ('Serves 4', 'Prep: 10 min') as a meta field, or null when it is prose. */
function readMeta(piece: string): [MetaKey, string] | null {
    const text = piece.replace(/[.;,]+$/, '').trim()
    for (const [re, key] of META) {
        const value = re.exec(text)?.[1]?.trim()
        if (!value) continue
        if (key === 'servings') {
            return SERVINGS_VALUE.test(value) && value.length <= MAX_SERVINGS_LENGTH ? [key, value] : null
        }
        return DURATION_VALUE.test(value) && value.length <= 40 ? [key, normalizeDurationLabel(value)] : null
    }
    return null
}

/**
 * Splits a header line into meta pieces: 'Prep: 10 min | Cook: 20 min',
 * 'Serves 4. Prep 30 min, cook 40 min.' or 'Prep 10 min and cook 20 min'.
 * Returns null unless every piece reads as meta, so a sentence that happens to
 * start with 'Serves' stays in the description.
 */
function readMetaLine(line: string): Array<[MetaKey, string]> | null {
    const pieces = line
        .split(/\s*[|•·;]\s*|(?<=\S)[.,]\s+(?=[A-Za-z])|\s+(?:and|plus)\s+(?=(?:prep|cook|bake|total|ready)\b)/i)
        .map((p) => p.trim())
        .filter(Boolean)
    const read = pieces.map(readMeta)
    return read.every((r) => r !== null) ? (read as Array<[MetaKey, string]>) : null
}

const LOOKS_LIKE_INGREDIENT = /^(?:\d|[½⅓⅔¼¾⅛⅜⅝⅞]|an?\s|one\s|two\s|three\s|pinch|dash|handful|salt|pepper)/i

function stripMarkdown(line: string): string {
    return line
        .replace(/^#{1,6}\s+/, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        .replace(/^>\s?/, '')
        .trim()
}

/** 'For the sauce:' style subheadings inside a section. */
function subheading(line: string): string | null {
    const bare = line.replace(/:$/, '').trim()
    if (!line.endsWith(':') && !/^for (?:the )?\w/i.test(line)) return null
    if (bare.length === 0 || bare.length > 50 || /\d/.test(bare.slice(0, 2))) return null
    if (!line.endsWith(':') && bare.split(/\s+/).length > 5) return null
    return bare
}

/** Splits '1. Mix. 2. Bake.' written as one paragraph. */
function splitInlineSteps(text: string): string[] {
    const parts = text.split(/\s+(?=(?:step\s*)?\d{1,2}[.)]\s+[A-Z])/i)
    return parts.length > 1 ? parts : [text]
}

export function parseRecipeText(input: string): ImportedRecipe {
    const rawLines = input.replace(/\r\n?/g, '\n').split('\n')
    const out: ImportedRecipe = {}
    const description: string[] = []
    const ingredients: string[] = []
    const instructions: string[] = []
    const notes: string[] = []
    let section: Section = 'intro'
    let sawHeader = false
    let pendingStep: string[] = []
    let stepsAreNumbered = false

    const flushStep = () => {
        if (pendingStep.length) instructions.push(pendingStep.join(' '))
        pendingStep = []
    }

    for (const raw of rawLines) {
        const line = stripMarkdown(collapseWhitespace(raw))
        if (!line) {
            if (section === 'instructions') flushStep()
            continue
        }
        if (!out.title) {
            if (URL_LINE.test(line)) {
                out.sourceUrl ??= line
                continue
            }
            out.title = cleanText(line.replace(/^recipe\s*:\s*/i, ''))
            continue
        }
        if (URL_LINE.test(line)) {
            out.sourceUrl ??= line
            continue
        }

        if (INGREDIENT_HEADER.test(line)) {
            flushStep()
            section = 'ingredients'
            sawHeader = true
            continue
        }
        if (INSTRUCTION_HEADER.test(line)) {
            flushStep()
            section = 'instructions'
            sawHeader = true
            continue
        }
        if (NOTES_HEADER.test(line)) {
            flushStep()
            section = 'notes'
            sawHeader = true
            continue
        }

        let isMeta = false
        const metaAllowed = section === 'intro' || (section === 'ingredients' && line.includes(':'))
        const meta = metaAllowed ? readMetaLine(line) : null
        if (meta) {
            for (const [key, value] of meta) if (!(key in out)) out[key] = value
            isMeta = true
        }
        if (isMeta) continue

        if (section === 'intro') {
            description.push(line)
            continue
        }
        if (section === 'notes') {
            notes.push(line)
            continue
        }
        const head = subheading(line)
        if (section === 'ingredients') {
            if (head) {
                ingredients.push(`# ${head}`)
                continue
            }
            ingredients.push(line.replace(BULLET, '').replace(/^\d{1,2}[.)]\s+(?=\D)/, ''))
            continue
        }
        // instructions
        if (head && !NUMBERED.test(line)) {
            flushStep()
            instructions.push(`# ${head}`)
            continue
        }
        for (const piece of splitInlineSteps(line)) {
            const numbered = NUMBERED.test(piece)
            const bullet = BULLET.test(piece)
            const text = piece.replace(NUMBERED, '').replace(BULLET, '').trim()
            if (!text) continue
            if (numbered || bullet) {
                stepsAreNumbered ||= numbered
                flushStep()
                pendingStep.push(text)
            } else if (stepsAreNumbered && pendingStep.length) {
                // A wrapped continuation of a numbered step.
                pendingStep.push(text)
            } else {
                flushStep()
                pendingStep.push(text)
            }
        }
    }
    flushStep()

    // No headers at all: sort the intro lines by shape.
    if (!sawHeader && description.length) {
        const leftover: string[] = []
        for (const line of description) {
            if (NUMBERED.test(line)) instructions.push(line.replace(NUMBERED, '').trim())
            else if (BULLET.test(line) || (LOOKS_LIKE_INGREDIENT.test(line) && line.length < 80))
                ingredients.push(line.replace(BULLET, ''))
            else if (ingredients.length && line.length > 60) instructions.push(line)
            else leftover.push(line)
        }
        description.length = 0
        description.push(...leftover)
    }

    const clean = (lines: string[]) =>
        lines
            .map((l) => (l.startsWith('# ') ? `# ${cleanText(l.slice(2))}` : cleanText(l)))
            .filter((l) => l && l !== '#')
    const ing = clean(ingredients)
    const ins = clean(instructions)
    if (description.length) out.description = cleanText(description.join(' '))
    if (ing.length) out.ingredients = ing
    if (ins.length) out.instructions = ins
    if (notes.length) out.notes = notes.map(cleanText).join('\n')
    if (out.servings) out.servings = cleanText(out.servings)
    return out
}
