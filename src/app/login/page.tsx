import type { Metadata } from 'next'
import { Icon } from '@/components/ui/icon'
import { Shape } from '@/components/ui/shape'
import { signInMethod } from '@/server/auth'
import styles from './login.module.scss'
import { LoginActions } from './login-actions'

export const metadata: Metadata = { title: 'Sign In' }

/** Same-origin path plus query only; anything else goes to the library. Shared text makes long ones. */
function safeNext(value: string | string[] | undefined): string | undefined {
    const next = Array.isArray(value) ? value[0] : value
    if (!next || next.length > 8192 || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
        return undefined
    }
    return next.startsWith('/login') ? undefined : next
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
    const params = await searchParams
    return (
        <main className={styles.page}>
            {/*
              A table of Expressive shapes in food colors: paprika, saffron, basil, cream.
              The four big ones carry what the app does: clip, cook, shop, and the kitchen screen.
            */}
            <div className={styles.art} aria-hidden>
                <span className={`${styles.shape} ${styles.paprika}`}>
                    <Shape name="cookie9" className={styles.fill} />
                    <Icon name="add_link" className={styles.glyph} />
                </span>
                <span className={`${styles.shape} ${styles.yolk}`}>
                    <Shape name="circle" className={styles.fill} />
                </span>
                <span className={`${styles.shape} ${styles.basil}`}>
                    <Shape name="clover4" className={styles.fill} />
                    <Icon name="shopping_basket" className={styles.glyph} />
                </span>
                <span className={`${styles.shape} ${styles.saffron}`}>
                    <Shape name="sunny" className={styles.fill} />
                    <Icon name="skillet" className={styles.glyph} />
                </span>
                <span className={`${styles.shape} ${styles.crust}`}>
                    <Shape name="pill" className={styles.fill} />
                    <Icon name="cast" className={styles.glyph} />
                </span>
                <span className={`${styles.shape} ${styles.berry}`}>
                    <Shape name="cookie4" className={styles.fill} />
                </span>
            </div>
            <div className={styles.panel}>
                <div className={styles.intro}>
                    <h1 className={styles.wordmark}>ClipCook</h1>
                    <p className={styles.lede}>Save recipes from any website and cook them step by step.</p>
                </div>
                <LoginActions method={signInMethod()} next={safeNext(params.next)} />
            </div>
        </main>
    )
}
