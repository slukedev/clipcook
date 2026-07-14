import Image from 'next/image'

interface RecipeImageProps {
    /** Storage URL or legacy base64 data URL. */
    src: string
    alt: string
    /** next/image sizes hint for the Storage path. */
    sizes?: string
    priority?: boolean
    className?: string
}

/**
 * Recipe photo that renders both storage shapes: Storage URLs go through
 * next/image (optimized, cached); legacy base64 data URLs use a plain <img>
 * (next/image cannot optimize data URLs). Both fill their container.
 */
export function RecipeImage({ src, alt, sizes = '100vw', priority = false, className }: RecipeImageProps) {
    if (src.startsWith('data:')) {
        // biome-ignore lint/performance/noImgElement: data URLs are already local bytes; next/image can't optimize them
        return <img src={src} alt={alt} className={className} style={{ objectFit: 'cover' }} />
    }
    return (
        <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            className={className}
            style={{ objectFit: 'cover' }}
        />
    )
}
