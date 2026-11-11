import type { CSSProperties, SVGProps } from 'react'
import { cx } from '../cx'
import styles from './icon.module.scss'

const MIRRORED = new Set<string>([
    'arrow_back',
    'arrow_forward',
    'chevron_left',
    'chevron_right',
    'keyboard_arrow_left',
    'open_in_new',
    'logout',
    'send',
    'undo',
    'redo',
    'skip_next',
    'skip_previous',
    'format_list_bulleted',
    'format_list_numbered',
    'view_list',
    'sort',
    'menu_open',
])

export interface SvgIconProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'name'> {
    /** Pixel size; defaults to the surrounding component's `--md-icon-size` or 24. */
    size?: number
    /** Accessible name. Without it the icon is decorative and hidden from assistive tech. */
    label?: string
}

export function SvgIcon({ d, name, size, label, className, style, ...rest }: SvgIconProps & { d: string; name: string }) {
    const sized = size ? ({ ...style, '--md-icon-size': `${size}px` } as CSSProperties) : style
    return (
        <svg
            viewBox="0 -960 960 960"
            className={cx(styles.icon, MIRRORED.has(name) && styles.mirror, className)}
            style={sized}
            role={label ? 'img' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
            focusable="false"
            data-icon={name}
            {...rest}
        >
            <path d={d} />
        </svg>
    )
}
