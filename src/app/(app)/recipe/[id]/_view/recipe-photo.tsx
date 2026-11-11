import Image from 'next/image'
import { Icon } from '@/components/ui/icon'
import { Shape, type ShapeName } from '@/components/ui/shape'
import styles from './recipe-photo.module.scss'

const PLACEHOLDER_SHAPES: ShapeName[] = ['cookie12', 'clover8', 'soft-burst', 'flower', 'cookie9', 'sunny', 'puffy']

function hash(text: string): number {
    let h = 0
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
    return Math.abs(h)
}

/**
 * The recipe photo, or a designed stand-in when there is none: a large MaterialShape
 * in the theme's container colors with a dish glyph. Data URLs (local backend, legacy
 * docs) render as plain img; storage URLs go through next/image.
 */
export function RecipePhoto({
    id,
    src,
    thumbnail,
    alt,
    sizes,
}: {
    id: string
    src: string
    /** The library card's image, already in the cache, shown until the full photo decodes. */
    thumbnail?: string
    alt: string
    sizes: string
}) {
    if (!src) {
        const shape = PLACEHOLDER_SHAPES[hash(id) % PLACEHOLDER_SHAPES.length] ?? 'cookie12'
        return (
            <div className={styles.placeholder} data-photo="none">
                <Shape name={shape} className={styles.backShape} />
                <Shape name="clover4" className={styles.frontShape} />
                <Icon name="skillet" className={styles.glyph} />
            </div>
        )
    }
    // The photo morphs in from its library card before the larger file has loaded, so the
    // card's thumbnail sits underneath and the morph never lands on an empty frame.
    const underlay =
        thumbnail && thumbnail !== src && !thumbnail.startsWith('data:') ? (
            // biome-ignore lint/performance/noImgElement: a cached thumbnail shown as-is
            <img className={styles.underlay} src={thumbnail} alt="" aria-hidden decoding="sync" />
        ) : null
    // Inline data, blobs and our own image route are already sized; the optimizer adds nothing.
    if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('/api/images/')) {
        return (
            <>
                {underlay}
                {/* biome-ignore lint/performance/noImgElement: see above */}
                <img className={styles.photo} src={src} alt={alt} decoding="async" fetchPriority="high" />
            </>
        )
    }
    return (
        <>
            {underlay}
            <Image className={styles.photo} src={src} alt={alt} fill sizes={sizes} fetchPriority="high" />
        </>
    )
}
