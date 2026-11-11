import { GLYPHS, type GlyphName } from './glyphs'
import { SvgIcon, type SvgIconProps } from './svg'

/** The few glyphs client components draw themselves; a few KB instead of the full icon map. */
export function Glyph({ name, ...rest }: SvgIconProps & { name: GlyphName }) {
    return <SvgIcon d={GLYPHS[name]} name={name} {...rest} />
}
