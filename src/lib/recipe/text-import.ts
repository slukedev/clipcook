// Pasted free text → ImportedRecipe. Client-safe.

import type { ImportedRecipe } from '@/lib/domain/types'
import { normalizeDurationLabel } from './time'
import { cleanText, collapseWhitespace } from './text'

type Section = 'intro' | 'ingredients' | 'instructions' | 'notes'

const INGREDIENT_HEADER = /^(?:ingredients?|ingredient list|what you(?:'|’)?ll need|you(?:'|’)?ll need|you will need|shopping list)\s*:?$/i
const INSTRUCTION_HEADER =
    /^(?:instructions?|directions?|method|preparation|prep(?:aration)? steps|steps?|how to make(?: it)?|procedure|to make)\s*:?$/i
const NOTES_HEADER = /^(?:notes?|tips?|cook(?:'|’)?s notes?|recipe notes?|variations?)\s*:?$/i

const BULLET = /^\s*(?:[-*•·▪◦‣⁃○●□■▢☐✓✔]|•)\s*/
const NUMBERED = /^\s*(?:step\s*)?(\d{1,2})\s*[.):]\s*|^\s*step\s+(\d{1,2})\s*[-:.]?\s*/i
const URL_LINE = /^https?:\/\/\S+$/i

const META: Array<[RegExp, keyof ImportedRecipe]> = [
    [/^(?:serves|servings|serving size|yield|yields|makes)\s*:?\s*(.+)$/i, 'servings'],
    [/^(?:prep(?:aration)?(?: time)?)\s*:\s*(.+)$/i, 'prepTime'],
    [/^(?:cook(?:ing)?(?: time)?|bake time|baking time)\s*:\s*(.+)$/i, 'cookTime'],
    [/^(?:total(?: time)?|ready in)\s*:?\s*(.+)$/i, 'totalTime'],
]

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

/** Splits 'Prep: 10 min | Cook: 20 min' into separate meta lines. */
function explodeMeta(line: string): string[] {
    if (!/[|•·]/.test(line)) return [line]
    const parts = line.split(/\s*[|•·]\s*/).filter(Boolean)
    return parts.every((p) => META.some(([re]) => re.test(p))) ? parts : [line]
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
        for (const piece of metaAllowed ? explodeMeta(line) : []) {
            for (const [re, key] of META) {
                const m = re.exec(piece)
                if (m?.[1] && !(key in out)) {
                    const value = m[1].trim()
                    ;(out as Record<string, string>)[key] = key === 'servings' ? value : normalizeDurationLabel(value)
                    isMeta = true
                    break
                }
            }
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
        lines.map((l) => (l.startsWith('# ') ? `# ${cleanText(l.slice(2))}` : cleanText(l))).filter((l) => l && l !== '#')
    const ing = clean(ingredients)
    const ins = clean(instructions)
    if (description.length) out.description = cleanText(description.join(' '))
    if (ing.length) out.ingredients = ing
    if (ins.length) out.instructions = ins
    if (notes.length) out.notes = notes.map(cleanText).join('\n')
    if (out.servings) out.servings = cleanText(out.servings)
    return out
}
