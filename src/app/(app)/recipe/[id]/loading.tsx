import homeStyles from '../../home.module.scss'
import styles from './recipe-view.module.scss'

const ROW_KEYS = ['a', 'b', 'c', 'd', 'e', 'f']

/** Skeleton mirroring the recipe hero + columns while the doc streams in. */
export default function Loading() {
    return (
        <main className={styles.main} aria-busy="true" aria-label="Loading recipe">
            <header className={styles.hero}>
                <div className={styles.heroText}>
                    <div
                        className={homeStyles.shimmer}
                        style={{ height: '2.5rem', width: 'min(24rem, 80%)', borderRadius: 12 }}
                    />
                    <div
                        className={homeStyles.shimmer}
                        style={{ height: '1.25rem', width: 'min(30rem, 95%)', borderRadius: 8 }}
                    />
                    <div className={homeStyles.shimmer} style={{ height: '2rem', width: '18rem', borderRadius: 999 }} />
                </div>
                <div
                    className={`${styles.heroImage} ${homeStyles.shimmer}`}
                    style={{ borderRadius: 'var(--md-sys-shape-corner-extra-large)' }}
                />
            </header>
            <div className={styles.columns}>
                <section className={styles.ingredients}>
                    <div
                        className={homeStyles.shimmer}
                        style={{ height: '1.75rem', width: '10rem', borderRadius: 8, marginBottom: '1rem' }}
                    />
                    {ROW_KEYS.map((key) => (
                        <div
                            key={key}
                            className={homeStyles.shimmer}
                            style={{ height: '3rem', borderRadius: 12, marginBottom: '0.5rem' }}
                        />
                    ))}
                </section>
                <section className={styles.directions}>
                    <div
                        className={homeStyles.shimmer}
                        style={{ height: '1.75rem', width: '10rem', borderRadius: 8, marginBottom: '1rem' }}
                    />
                    {ROW_KEYS.slice(0, 4).map((key) => (
                        <div
                            key={key}
                            className={homeStyles.shimmer}
                            style={{ height: '4.5rem', borderRadius: 12, marginBottom: '0.75rem' }}
                        />
                    ))}
                </section>
            </div>
        </main>
    )
}
