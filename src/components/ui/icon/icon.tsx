import { ICON_PATHS, type IconName } from './icon-paths'
import { SvgIcon, type SvgIconProps } from './svg'

export interface IconProps extends SvgIconProps {
    name: IconName
    /** Filled variant, for selected and active states. */
    filled?: boolean
}

/**
 * Material Symbols Rounded. Render it in server components and pass the element to
 * client components (`icon={<Icon name="add" />}`) so the path map stays on the server.
 */
export function Icon({ name, filled = false, ...rest }: IconProps) {
    const [outline, fill] = ICON_PATHS[name]
    return <SvgIcon d={filled ? fill : outline} name={name} {...rest} />
}
