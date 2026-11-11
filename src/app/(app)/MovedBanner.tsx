'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'
import styles from './moved-banner.module.scss'

const NEW_APP_URL = 'https://clipcook.sluke.dev'

interface PlannedPart {
    part: number
    from: string
    to: string | null
}

type State =
    | { kind: 'idle' }
    | { kind: 'preparing' }
    | { kind: 'empty' }
    | { kind: 'error' }
    | { kind: 'parts'; parts: PlannedPart[] }

function partUrl({ part, from, to }: PlannedPart): string {
    const params = new URLSearchParams({ part: String(part), from })
    if (to) params.set('to', to)
    return `/api/export?${params}`
}

/** The route answers with Content-Disposition: attachment, so this downloads in place. */
function download(part: PlannedPart) {
    const a = document.createElement('a')
    a.href = partUrl(part)
    a.download = `clipcook-export-${part.part}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
}

export function MovedBanner() {
    const [state, setState] = useState<State>({ kind: 'idle' })

    async function startExport() {
        setState({ kind: 'preparing' })
        try {
            const res = await fetch('/api/export', { cache: 'no-store' })
            if (!res.ok) throw new Error(String(res.status))
            const plan = (await res.json()) as { total: number; parts: PlannedPart[] }
            if (plan.parts.length === 0) {
                setState({ kind: 'empty' })
                return
            }
            if (plan.parts.length === 1) download(plan.parts[0] as PlannedPart)
            setState({ kind: 'parts', parts: plan.parts })
        } catch {
            setState({ kind: 'error' })
        }
    }

    const multiple = state.kind === 'parts' && state.parts.length > 1

    return (
        <section className={styles.banner} aria-labelledby="moved-banner-title">
            <div className={styles.text}>
                <h2 id="moved-banner-title" className={styles.title}>
                    ClipCook Has Moved
                </h2>
                <p className={styles.body}>
                    Export your recipes here, then add them to the new app from Settings &gt; Import.
                </p>
                {state.kind === 'empty' && <p className={styles.status}>No recipes to export.</p>}
                {state.kind === 'error' && <p className={styles.status}>Export failed. Try again.</p>}
                {state.kind === 'parts' && state.parts.length === 1 && (
                    <p className={styles.status}>Your download has started.</p>
                )}
                {multiple && (
                    <p className={styles.status}>
                        Your recipes are split into {state.parts.length} files. Download and import each one.
                    </p>
                )}
            </div>
            <div className={styles.actions}>
                {multiple ? (
                    state.parts.map((part) => (
                        <Button key={part.part} variant="tonal" icon="arrow_downward" onClick={() => download(part)}>
                            {`Part ${part.part}`}
                        </Button>
                    ))
                ) : (
                    <Button
                        variant="tonal"
                        icon="arrow_downward"
                        onClick={startExport}
                        disabled={state.kind === 'preparing'}
                    >
                        {state.kind === 'preparing' ? 'Preparing' : 'Export recipes'}
                    </Button>
                )}
                <Button variant="text" icon="link" href={NEW_APP_URL}>
                    Open new app
                </Button>
            </div>
        </section>
    )
}
