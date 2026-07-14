'use client'

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import Image from 'next/image'
import { useState, useTransition } from 'react'
import { Chip, Icon, LoadingIndicator } from '@/components/ui'
import { getClientAuth } from '@/lib/firebase-client'
import { signInAction } from './actions'
import styles from './login.module.scss'

function GoogleG() {
    return (
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path
                fill="#4285F4"
                d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
            />
            <path
                fill="#34A853"
                d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
            />
            <path
                fill="#FBBC05"
                d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
            />
            <path
                fill="#EA4335"
                d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
            />
        </svg>
    )
}

export function LoginClient({ nextPath }: { nextPath?: string }) {
    const [error, setError] = useState<string | null>(null)
    const [signingIn, setSigningIn] = useState(false)
    const [isPending, startTransition] = useTransition()

    async function continueWithGoogle() {
        setError(null)
        setSigningIn(true)
        try {
            const auth = getClientAuth()
            const provider = new GoogleAuthProvider()
            provider.setCustomParameters({ prompt: 'select_account' })
            const result = await signInWithPopup(auth, provider)
            const idToken = await result.user.getIdToken()
            await auth.signOut()
            startTransition(() => {
                void signInAction(idToken, nextPath)
            })
        } catch (e) {
            setSigningIn(false)
            setError(e instanceof Error ? e.message : 'Sign-in failed')
        }
    }

    const busy = signingIn || isPending

    return (
        <main className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroInner}>
                    <div className={styles.brandRow}>
                        <Image src="/logo.webp" alt="" width={36} height={36} className={styles.logo} priority />
                        <span className={styles.wordmark}>ClipCook</span>
                    </div>
                    <h1 className={styles.headline}>
                        Clip it.
                        <br />
                        Keep it.
                        <br />
                        Cook it.
                    </h1>
                    <p className={styles.tagline}>
                        Every recipe you love, saved from anywhere on the web, scaled, converted, and ready when the pan
                        is hot.
                    </p>
                    <div className={styles.featureChips}>
                        <Chip icon="link">Clip from any site</Chip>
                        <Chip icon="group">Scale servings</Chip>
                        <Chip icon="straighten">Convert units</Chip>
                    </div>
                </div>
            </section>

            <section className={styles.panel}>
                <div className={styles.panelInner}>
                    <h2 className={styles.welcome}>Welcome back</h2>
                    <p className={styles.welcomeSub}>Sign in to open your cookbook.</p>
                    <button type="button" className={styles.googleButton} onClick={continueWithGoogle} disabled={busy}>
                        {busy ? <LoadingIndicator size={24} label="Signing you in" /> : <GoogleG />}
                        <span>{busy ? 'Signing you in…' : 'Continue with Google'}</span>
                    </button>
                    {error && (
                        <p className={styles.error} role="alert">
                            <Icon name="error" size={18} />
                            {error}
                        </p>
                    )}
                    <p className={styles.fineprint}>Your recipes are private to your Google account.</p>
                </div>
            </section>
        </main>
    )
}
