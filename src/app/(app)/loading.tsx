import styles from './home.module.scss'

const PLACEHOLDER_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

/** Skeleton of the recipe grid while the list streams in. */
export default function Loading() {
    return (
        <main className={styles.main} aria-busy="true" aria-label="Loading your recipes">
            <header className={styles.header}>
                <div className={styles.headlineGroup}>
                    <div className={`${styles.skeletonBar} ${styles.shimmer}`} />
                    <div className={`${styles.skeletonLine} ${styles.shimmer}`} />
                </div>
            </header>
            <div className={styles.grid}>
                {PLACEHOLDER_KEYS.map((key) => (
                    <div key={key} className={`${styles.skeletonCard} ${styles.shimmer}`} />
                ))}
            </div>
        </main>
    )
}
