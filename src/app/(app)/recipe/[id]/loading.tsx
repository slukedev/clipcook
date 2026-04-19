import styles from '@/styles/Home.module.scss'
import { Main } from '@/components/main'
import { Spinner } from '@/components/spinner'

export default function Loading() {
    return (
        <Main pageName="recipe">
            <div className={styles.loading}>
                <h1>Loading recipe…</h1>
                <Spinner />
                <p>I wonder if Belle would approve…</p>
            </div>
        </Main>
    )
}
