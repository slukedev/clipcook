import homeStyles from '../../../home.module.scss'
import styles from '../../../recipe-form.module.scss'

const FIELD_KEYS = ['a', 'b', 'c', 'd']

/** Skeleton mirroring the edit form while the recipe loads. */
export default function Loading() {
    return (
        <main className={styles.main} aria-busy="true" aria-label="Loading editor">
            <header className={styles.header}>
                <div className={homeStyles.shimmer} style={{ height: '2.25rem', width: '12rem', borderRadius: 12 }} />
            </header>
            <div className={styles.form}>
                <div
                    className={`${styles.photoPicker} ${homeStyles.shimmer}`}
                    style={{ cursor: 'default' }}
                    aria-hidden="true"
                />
                {FIELD_KEYS.map((key) => (
                    <div key={key} className={homeStyles.shimmer} style={{ height: '3.5rem', borderRadius: 8 }} />
                ))}
            </div>
        </main>
    )
}
