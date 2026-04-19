import styles from '@/styles/Home.module.scss'
import { Main } from '@/components/main'
import { Spinner } from '@/components/spinner'

export default function Loading() {
    return (
        <Main pageName="index">
            <div className={styles.loading}>
                <h1>Loading recipes…</h1>
                <Spinner />
                <p>And chasing Belle off the counter…</p>
            </div>
        </Main>
    )
}
