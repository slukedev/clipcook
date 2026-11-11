// The pans, tools and appliances a recipe's steps call for, read from the step text so
// cook mode can list them before the first step. Pure and client-safe.

import { isHeadingLine } from '@/lib/recipe/text'

interface Tool {
    /** One label per tool, so "the skillet" in step 4 does not list it twice. */
    key: string
    pattern: RegExp
    /** Words allowed in front of the tool name, kept in the label ("12-inch skillet"). */
    sized?: boolean
}

// Longer names first: "Dutch oven" before "oven", "sheet pan" before "pan".
const TOOLS: Tool[] = [
    { key: 'dutch oven', pattern: /dutch ovens?/, sized: true },
    { key: 'springform pan', pattern: /springform pans?/, sized: true },
    { key: 'loaf pan', pattern: /loaf pans?|loaf tins?/, sized: true },
    { key: 'cake pan', pattern: /cake pans?|cake tins?/, sized: true },
    { key: 'muffin tin', pattern: /muffin (?:tins?|pans?)/, sized: true },
    { key: 'roasting pan', pattern: /roasting pans?|roasting tins?/, sized: true },
    { key: 'baking dish', pattern: /baking dish(?:es)?|casserole dish(?:es)?/, sized: true },
    { key: 'sheet pan', pattern: /sheet pans?|baking sheets?|baking trays?|lined sheets?/, sized: true },
    { key: 'saucepan', pattern: /saucepans?/, sized: true },
    { key: 'skillet', pattern: /skillets?|frying pans?|frypans?/, sized: true },
    { key: 'wok', pattern: /woks?/, sized: true },
    { key: 'griddle', pattern: /griddles?/, sized: true },
    { key: 'pot', pattern: /(?:stock)?pots?/, sized: true },
    { key: 'mixing bowl', pattern: /(?:mixing )?bowls?/, sized: true },
    { key: 'food processor', pattern: /food processors?/ },
    { key: 'blender', pattern: /(?:immersion |stick )?blenders?/ },
    { key: 'stand mixer', pattern: /stand mixers?|hand mixers?|electric mixers?|mixers?/ },
    { key: 'grill', pattern: /grill(?! pan)|grill pans?|barbecue/ },
    { key: 'slow cooker', pattern: /slow cookers?|crock ?pots?/ },
    { key: 'pressure cooker', pattern: /pressure cookers?|instant pots?/ },
    { key: 'microwave', pattern: /microwave/ },
    { key: 'colander', pattern: /colanders?|sieves?|strainers?/ },
    { key: 'skewers', pattern: /skewers/ },
    { key: 'rolling pin', pattern: /rolling pins?/ },
    { key: 'thermometer', pattern: /thermometers?/ },
    { key: 'parchment', pattern: /parchment(?: paper)?|baking paper/ },
    { key: 'foil', pattern: /(?:aluminum |aluminium |tin )?foil/ },
    { key: 'banneton', pattern: /bannetons?|proofing baskets?/ },
]

const SIZE =
    /(?:\d+(?:\s*(?:by|x|×)\s*\d+)?(?:-|\s)?(?:inch|in\.?|cm|quart|qt|liter|litre)\s+|(?:very |extra-)?(?:large|small|medium|big|heavy|deep|wide|shallow|light-colored|nonstick|non-stick|cast-iron|cast iron|oven-safe|ovenproof)\s+)*/

const OVEN = /\b(?<!dutch )oven\b/
const OVEN_TEMP = /\boven\b[^.]{0,30}?\b(\d{3})\s*°?\s*([fc])\b|\b(\d{3})\s*°?\s*([fc])\b[^.]{0,30}?\boven\b/

const TOOL_RES = TOOLS.map((tool) => ({
    ...tool,
    re: new RegExp(`\\b(${tool.sized ? SIZE.source : ''})(${tool.pattern.source})\\b`, 'g'),
}))

function singular(name: string): string {
    if (/(?:skewers)$/.test(name)) return name
    if (/dish(?:es)$/.test(name)) return name.slice(0, -2)
    return name.replace(/s$/, '')
}

/** Joins "325" and "F" into "325°F". */
function degrees(value: string, unit: string): string {
    return `${value}°${unit.toUpperCase()}`
}

/**
 * The equipment named in the steps, in the order it is first needed, sentence case:
 * ["Oven, 425°F", "Large sheet pan", "Mixing bowl"]. Sizes and descriptors from the
 * text are kept; generic mentions ("the pan") are left out.
 */
export function findEquipment(instructions: readonly string[]): string[] {
    const found = new Map<string, { at: number; label: string }>()
    let offset = 0
    for (const raw of instructions) {
        if (isHeadingLine(raw)) continue
        const line = raw.toLowerCase()
        if (OVEN.test(line) && !found.has('oven')) {
            const temp = OVEN_TEMP.exec(line)
            const label = temp ? `Oven, ${degrees(temp[1] ?? temp[3] ?? '', temp[2] ?? temp[4] ?? 'f')}` : 'Oven'
            found.set('oven', { at: offset + (OVEN.exec(line)?.index ?? 0), label })
        }
        for (const tool of TOOL_RES) {
            tool.re.lastIndex = 0
            for (const match of line.matchAll(tool.re)) {
                // Labels keep the step's own casing ("Dutch oven"); matching ran on lowercase.
                const start = match.index ?? 0
                const size = raw.slice(start, start + (match[1] ?? '').length).trim()
                const said = singular(raw.slice(start + (match[1] ?? '').length, start + match[0].length))
                const name = /^lined sheet$/i.test(said) ? 'baking sheet' : said
                const at = offset + start
                const label = size ? `${size} ${name}` : name
                const prior = found.get(tool.key)
                // A later, more specific mention ("12-inch skillet") replaces a bare one.
                if (!prior) found.set(tool.key, { at, label })
                else if (size && !prior.label.includes(' ')) found.set(tool.key, { at: prior.at, label })
            }
        }
        offset += line.length + 1
    }
    return [...found.values()]
        .sort((a, b) => a.at - b.at)
        .map(({ label }) => label.charAt(0).toUpperCase() + label.slice(1))
}
