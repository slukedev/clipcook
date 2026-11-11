import { LoadingIndicator } from '@/components/ui/loading-indicator'
import styles from './route-loading.module.scss'

export function RouteLoading() {
    return (
        <div className={styles.root} role="status" aria-busy="true">
            <LoadingIndicator label="Loading" />
        </div>
    )
}
