'use client'

import { Avatar as BaseAvatar } from '@base-ui/react/avatar'
import type { CSSProperties } from 'react'
import { cx } from '../cx'
import { shapeMask } from '../shape/shape'
import type { ShapeName } from '../shape/shape-paths'
import styles from './avatar.module.scss'

export interface AvatarProps {
    src?: string | null
    /** Person or thing pictured; initials come from it when there is no image. */
    name: string
    /** Diameter in px (24, 32, 40, 56...). */
    size?: number
    /** Clip to a MaterialShape instead of a circle. */
    shape?: ShapeName
    className?: string
}

function initials(name: string) {
    const parts = name.trim().split(/\s+/)
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase()
}

export function Avatar({ src, name, size = 40, shape, className }: AvatarProps) {
    const style = {
        '--_size': `${size}px`,
        ...(shape ? { mask: shapeMask(shape), WebkitMask: shapeMask(shape), borderRadius: 0 } : {}),
    } as CSSProperties
    return (
        <BaseAvatar.Root className={cx(styles.avatar, className)} style={style}>
            {src && <BaseAvatar.Image src={src} alt={name} className={styles.image} />}
            <BaseAvatar.Fallback className={styles.fallback} aria-label={name}>
                {initials(name)}
            </BaseAvatar.Fallback>
        </BaseAvatar.Root>
    )
}
