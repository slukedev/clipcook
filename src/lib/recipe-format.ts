// Compatibility shim: new code imports from '@/lib/recipe/*' directly.
import { formatQuantity, prettifyFractions, scaleIngredient } from './recipe/ingredients'
import { decodeEntities } from './recipe/text'

export { scaleIngredient }
export const unescapeHtml = decodeEntities
export const formatAmounts = prettifyFractions

export function displayIngredient(ingredient: string, scale: number): string {
    return scaleIngredient(decodeEntities(ingredient), scale)
}

export function formatFraction(value: number): string {
    return formatQuantity(value)
}
