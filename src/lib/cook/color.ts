import type { Contrast } from '@/lib/theme/preference'
import { dynamicColorCss } from '@/lib/theme/scheme'

/**
 * The recipe's photo colors for its page, and for the menus, dialogs, sheets and
 * snackbars it opens: those portal to <body>, outside the page wrapper.
 */
export function recipeColorCss(id: string, seed: number, contrast: Contrast): string {
    const scope = `[data-recipe="${id}"]`
    return [
        dynamicColorCss(scope, seed, { contrast }),
        dynamicColorCss(`body:has(${scope}) > [data-base-ui-portal]`, seed, { contrast }),
    ].join('\n')
}
