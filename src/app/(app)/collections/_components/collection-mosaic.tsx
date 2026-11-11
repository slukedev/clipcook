import { RecipeMedia, RecipePlaceholder } from '../../_library/recipe-media'
import styles from './collection-mosaic.module.scss'

/** Up to four recipe photos tiled 2 by 2; a tinted shape when the collection has none. */
export function CollectionMosaic({ name, thumbnails }: { name: string; thumbnails: string[] }) {
    const tiles = thumbnails.slice(0, 4)
    return (
        <div className={styles.mosaic} data-count={tiles.length}>
            {tiles.length === 0 ? (
                <RecipePlaceholder title={name} />
            ) : (
                tiles.map((src, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: thumbnails can repeat; position is the identity
                    <div key={index} className={styles.tile}>
                        <RecipeMedia src={src} title={name} sizes="(width < 600px) 25vw, 160px" />
                    </div>
                ))
            )}
        </div>
    )
}
