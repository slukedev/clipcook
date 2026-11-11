import type { Metadata } from 'next'
import { Shape } from '@/components/ui/shape'
import { signInMethod } from '@/server/auth'
import { LoginActions } from './login-actions'
import styles from './login.module.scss'

export const metadata: Metadata = { title: 'Sign in' }

/** Same-origin path plus query only; anything else goes to the library. */
function safeNext(value: string | string[] | undefined): string | undefined {
    const next = Array.isArray(value) ? value[0] : value
    if (!next || next.length > 512 || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
        return undefined
    }
    return next.startsWith('/login') ? undefined : next
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
    const params = await searchParams
    return (
        <main className={styles.page}>
            {/* A table of Expressive shapes in food colors: paprika, saffron, basil, cream. */}
            <div className={styles.art} aria-hidden>
                <Shape name="cookie9" className={`${styles.shape} ${styles.paprika}`} />
                <Shape name="circle" className={`${styles.shape} ${styles.yolk}`} />
                <Shape name="clover4" className={`${styles.shape} ${styles.basil}`} />
                <Shape name="sunny" className={`${styles.shape} ${styles.saffron}`} />
                <Shape name="pill" className={`${styles.shape} ${styles.crust}`} />
                <Shape name="cookie4" className={`${styles.shape} ${styles.berry}`} />
            </div>
            <div className={styles.panel}>
                <h1 className={styles.wordmark}>ClipCook</h1>
                <LoginActions method={signInMethod()} next={safeNext(params.next)} />
            </div>
        </main>
    )
}
