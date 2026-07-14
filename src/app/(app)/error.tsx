'use client'

import { useEffect } from 'react'
import { Button, EmptyState } from '@/components/ui'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <main>
            <EmptyState
                icon="error"
                headline="Something went wrong"
                body={
                    error.digest
                        ? `Belle has, once again, gotten into the recipe drawer. (Ref: ${error.digest})`
                        : 'Belle has, once again, gotten into the recipe drawer.'
                }
            >
                <Button icon="refresh" onClick={reset}>
                    Try again
                </Button>
            </EmptyState>
        </main>
    )
}
