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
export function RecipePhoto({ id, src, alt, sizes }: { id: string; src: string; alt: string; sizes: string }) {
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
    if (src.startsWith('data:') || src.startsWith('blob:')) {
        // biome-ignore lint/performance/noImgElement: inline data URLs gain nothing from the optimizer
        return <img className={styles.photo} src={src} alt={alt} decoding="async" fetchPriority="high" />
    }
    return <Image className={styles.photo} src={src} alt={alt} fill sizes={sizes} fetchPriority="high" />
}
