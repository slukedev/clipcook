import { cx } from '../cx'
import { ICON_PATHS, type IconName } from './icon-paths'
import styles from './icon.module.scss'

export type { IconName }

interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'name'> {
    name: IconName
    /** Use the filled variant (selected/active states). */
    filled?: boolean
    /** Icon size — M3 default is 24. */
    size?: 18 | 20 | 24 | 36 | 40 | 48
}

/**
 * Material Symbol rendered as an inline SVG (no icon font).
 * Decorative by default; pass aria-label to make it meaningful.
 */
export function Icon({ name, filled = false, size = 24, className, 'aria-label': ariaLabel, ...props }: IconProps) {
    return (
        <svg
            viewBox="0 -960 960 960"
            width={size}
            height={size}
            className={cx(styles.icon, className)}
            aria-hidden={ariaLabel ? undefined : true}
            aria-label={ariaLabel}
            role={ariaLabel ? 'img' : undefined}
            focusable="false"
            {...props}
        >
            <path fill="currentColor" d={filled ? ICON_PATHS[name].fill : ICON_PATHS[name].outline} />
        </svg>
    )
}
