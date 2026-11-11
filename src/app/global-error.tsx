'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { SvgIcon } from '@/components/ui/icon/svg'
import { ERROR } from './_status/glyphs'
import { StatusScreen } from './_status/status-screen'
import '@/styles/globals.scss'

// Replaces the root layout, so it brings its own document and styles. The theme
// follows the OS here because the root layout's cookie read did not run.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
    useEffect(() => {
        console.error(error)
    }, [error])
    return (
        <html lang="en" dir="ltr">
            <body>
                <title>ClipCook</title>
                <main>
                    <StatusScreen
                        fullscreen
                        shape="puffy"
                        icon={<SvgIcon d={ERROR} name="error" />}
                        title="ClipCook Hit a Problem"
                        action={
                            <Button size="m" onClick={() => retry()}>
                                Try again
                            </Button>
                        }
                    />
                </main>
            </body>
        </html>
    )
}
