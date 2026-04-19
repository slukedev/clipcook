import styles from '@/styles/Home.module.scss'
import { Main } from '@/components/main'
import { Spinner } from '@/components/spinner'

export default function Loading() {
    return (
        <Main pageName="create">
            <div className={styles.loading} style={{ marginTop: 25 }}>
                <h1>Loading</h1>
                <Spinner />
                <p>Gathering the recipe details…</p>
            </div>
        </Main>
    )
}
