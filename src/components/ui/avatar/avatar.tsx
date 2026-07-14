'use client'

import { Avatar as BaseAvatar } from '@base-ui/react/avatar'
import { cx } from '../cx'
import styles from './avatar.module.scss'

interface AvatarProps {
    src?: string | null
    /** Display name — used for the initials fallback and alt text. */
    name: string
    size?: 32 | 40 | 48
    className?: string
}

function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/)
    const first = parts[0]?.[0] ?? ''
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
    return (first + last).toUpperCase() || '?'
}

/** Circular avatar with tonal initials fallback. */
export function Avatar({ src, name, size = 40, className }: AvatarProps) {
    return (
        <BaseAvatar.Root className={cx(styles.avatar, className)} style={{ width: size, height: size }}>
            {src && <BaseAvatar.Image src={src} className={styles.image} alt={name} referrerPolicy="no-referrer" />}
            <BaseAvatar.Fallback className={styles.fallback}>{initialsOf(name)}</BaseAvatar.Fallback>
        </BaseAvatar.Root>
    )
}
