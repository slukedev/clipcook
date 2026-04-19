'use client'

import { useEffect } from 'react'
import styles from '@/styles/Home.module.scss'
import { Button } from '@/components/button'
import { Main } from '@/components/main'

export default function AppError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <Main pageName="recipe">
            <div className={styles.loading}>
                <h1>Something went wrong</h1>
                <p>Belle has, once again, gotten into the recipe drawer.</p>
                {error.digest ? <p style={{ opacity: 0.6 }}>Ref: {error.digest}</p> : null}
                <Button onClick={reset}>Try again</Button>
            </div>
        </Main>
    )
}
