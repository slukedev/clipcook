import Image from 'next/image'
import type { CSSProperties } from 'react'
import { cx } from '@/components/ui/cx'
import { Shape } from '@/components/ui/shape'
import { placeholderLook } from './library-data'
import styles from './recipe-media.module.scss'

interface RecipeMediaProps {
    src: string
    title: string
    /** next/image sizes for hosted photos. */
    sizes?: string
    priority?: boolean
    className?: string
}

/**
 * A recipe's photo filling its box, or a designed stand-in when there is none:
 * an Expressive shape tinted from the title with the recipe's initial.
 */
export function RecipeMedia({
    src,
    title,
    sizes = '(width < 600px) 50vw, 25vw',
    priority,
    className,
}: RecipeMediaProps) {
    if (!src) return <RecipePlaceholder title={title} className={className} />
    if (src.startsWith('data:')) {
        return (
            // biome-ignore lint/performance/noImgElement: inline data URLs gain nothing from next/image
            <img
                src={src}
                alt=""
                className={cx(styles.photo, className)}
                loading={priority ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={priority ? 'high' : undefined}
            />
        )
    }
    return <Image src={src} alt="" fill sizes={sizes} priority={priority} className={cx(styles.photo, className)} />
}

export function RecipePlaceholder({ title, className }: { title: string; className?: string }) {
    const look = placeholderLook(title)
    return (
        <div className={cx(styles.placeholder, className)} style={{ '--_hue': look.hue } as CSSProperties} aria-hidden>
            <Shape name={look.shape} className={styles.shape} />
            <span className={styles.initial}>{look.initial}</span>
        </div>
    )
}
