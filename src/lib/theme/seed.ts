/** ARGB int (as stored on recipe docs) → #rrggbb hex. */
export function seedToHex(argb: number): string {
    return `#${(argb & 0xffffff).toString(16).padStart(6, '0')}`
}
