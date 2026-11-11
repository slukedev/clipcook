'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useRef, useState } from 'react'
import { List, ListItem } from '@/components/ui/list'
import { CircularProgress } from '@/components/ui/progress'
import { useSnackbar } from '@/components/ui/snackbar'
import type { ImportCounts } from '@/lib/domain/types'

interface DataProps {
    icons: { export: ReactNode; import: ReactNode }
}

function importedMessage(counts: ImportCounts): string {
    const added = counts.recipesAdded === 1 ? '1 recipe' : `${counts.recipesAdded} recipes`
    if (counts.recipesAdded === 0 && counts.recipesSkipped > 0) return 'Those recipes are already here'
    if (counts.recipesSkipped > 0) return `Imported ${added}, skipped ${counts.recipesSkipped} already here`
    return `Imported ${added}`
}

/** Uploads with XMLHttpRequest because fetch still cannot report upload progress. */
function upload(file: File, onProgress: (fraction: number) => void): Promise<ImportCounts> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const body = new FormData()
        body.append('file', file)
        xhr.open('POST', '/api/import')
        xhr.responseType = 'json'
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) onProgress(event.loaded / event.total)
        }
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response as ImportCounts)
            else reject(new Error((xhr.response as { error?: string } | null)?.error ?? 'Import failed. Try again.'))
        }
        xhr.onerror = () => reject(new Error("Couldn't reach ClipCook. Check your connection and try again."))
        xhr.send(body)
    })
}

export function DataSection({ icons }: DataProps) {
    const router = useRouter()
    const snackbar = useSnackbar()
    const inputRef = useRef<HTMLInputElement>(null)
    const [progress, setProgress] = useState<number | null>(null)

    const run = async (file: File) => {
        setProgress(0)
        try {
            const counts = await upload(file, setProgress)
            snackbar(importedMessage(counts))
            router.refresh()
        } catch (err) {
            snackbar({
                message: err instanceof Error ? err.message : 'Import failed. Try again.',
                action: 'Retry',
                onAction: () => void run(file),
                urgent: true,
            })
        } finally {
            setProgress(null)
        }
    }

    const busy = progress !== null
    return (
        <>
            <List segmented label="Data">
                <ListItem
                    leading={icons.export}
                    headline="Export"
                    supporting="Download every recipe as a JSON file"
                    onClick={() => {
                        const link = document.createElement('a')
                        link.href = '/api/export'
                        link.download = ''
                        link.click()
                    }}
                />
                <ListItem
                    leading={icons.import}
                    headline={busy ? 'Importing' : 'Import'}
                    supporting="Add recipes from a ClipCook export"
                    disabled={busy}
                    trailing={
                        busy ? (
                            <CircularProgress
                                size={32}
                                value={progress > 0 && progress < 1 ? progress : undefined}
                                label="Import progress"
                            />
                        ) : undefined
                    }
                    onClick={() => inputRef.current?.click()}
                />
            </List>
            <input
                ref={inputRef}
                type="file"
                accept="application/json,.json"
                hidden
                tabIndex={-1}
                aria-hidden
                onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void run(file)
                }}
            />
        </>
    )
}
