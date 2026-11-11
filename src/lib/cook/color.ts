import type { Contrast } from '@/lib/theme/preference'
import { dynamicColorCss } from '@/lib/theme/scheme'

/**
 * The recipe's photo colors for the whole window while its page is open: the page, the
 * app shell around it (navigation rail, bars, FAB), the body background, and the menus,
 * dialogs, sheets and snackbars that portal to <body>. Leaving the page drops the
 * `<style>` along with the `[data-recipe]` it keys on, so the shell goes back to the
 * app's own colors.
 */
export function recipeColorCss(id: string, seed: number, contrast: Contrast): string {
    return dynamicColorCss(`body:has([data-recipe="${id}"])`, seed, { contrast })
}
