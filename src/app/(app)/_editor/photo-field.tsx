'use client'

import { type DragEvent, useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { LoadingIndicator } from '@/components/ui/loading-indicator'
import { Shape } from '@/components/ui/shape'
import { useSnackbar } from '@/components/ui/snackbar'
import type { EditorIcons } from './icons'
import { isImageFile, preparePhoto } from './photo'
import styles from './photo-field.module.scss'
import type { EditorPhoto } from './values'

interface PhotoFieldProps {
    photo: EditorPhoto
    onChange: (photo: EditorPhoto) => void
    icons: EditorIcons
    /** Accessible name for the image, usually the recipe title. */
    alt: string
}

function hasFiles(event: DragEvent): boolean {
    return Array.from(event.dataTransfer.types).includes('Files')
}

/** Photo slot: pick, take, drop or paste an image; change or remove it with undo. */
export function PhotoField({ photo, onChange, icons, alt }: PhotoFieldProps) {
    const pickId = useId()
    const cameraId = useId()
    const snackbar = useSnackbar()
    const [over, setOver] = useState(false)
    const [busy, setBusy] = useState(false)
    const [canCapture, setCanCapture] = useState(false)
    const depth = useRef(0)
    const created = useRef<string[]>([])

    // Coarse pointers usually mean a phone camera is one tap away.
    useEffect(() => {
        setCanCapture(window.matchMedia('(pointer: coarse)').matches)
    }, [])

    // Undo can bring back an earlier pick, so object URLs live as long as the editor.
    useEffect(() => {
        const urls = created.current
        return () => {
            for (const url of urls) URL.revokeObjectURL(url)
        }
    }, [])

    async function take(file: File | null | undefined) {
        if (!isImageFile(file)) {
            if (file) snackbar({ message: 'That file is not an image.', urgent: true })
            return
        }
        setBusy(true)
        try {
            const blob = await preparePhoto(file)
            const src = URL.createObjectURL(blob)
            created.current.push(src)
            onChange({ kind: 'picked', file: blob, src })
        } finally {
            setBusy(false)
        }
    }

    // Paste an image anywhere on the page unless a text field wants the paste.
    useEffect(() => {
        function onPaste(event: ClipboardEvent) {
            const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'))
            if (!file) return
            event.preventDefault()
            void take(file)
        }
        document.addEventListener('paste', onPaste)
        return () => document.removeEventListener('paste', onPaste)
    })

    function remove() {
        const previous = photo
        onChange({ kind: 'none' })
        snackbar({ message: 'Photo removed', action: 'Undo', onAction: () => onChange(previous) })
    }

    const dropProps = {
        onDragEnter: (e: DragEvent) => {
            if (!hasFiles(e)) return
            e.preventDefault()
            depth.current += 1
            setOver(true)
        },
        onDragOver: (e: DragEvent) => {
            if (!hasFiles(e)) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
        },
        onDragLeave: () => {
            depth.current = Math.max(0, depth.current - 1)
            if (depth.current === 0) setOver(false)
        },
        onDrop: (e: DragEvent) => {
            if (!hasFiles(e)) return
            e.preventDefault()
            depth.current = 0
            setOver(false)
            void take(e.dataTransfer.files[0])
        },
    }

    const inputs = (
        <>
            <input
                id={pickId}
                className={styles.file}
                type="file"
                accept="image/*"
                tabIndex={-1}
                onChange={(e) => {
                    void take(e.currentTarget.files?.[0])
                    e.currentTarget.value = ''
                }}
            />
            <input
                id={cameraId}
                className={styles.file}
                type="file"
                accept="image/*"
                capture="environment"
                tabIndex={-1}
                onChange={(e) => {
                    void take(e.currentTarget.files?.[0])
                    e.currentTarget.value = ''
                }}
            />
        </>
    )

    const pick = () => document.getElementById(pickId)?.click()
    const shoot = () => document.getElementById(cameraId)?.click()

    if (photo.kind === 'none') {
        return (
            <div className={styles.empty} data-over={over || undefined} aria-busy={busy || undefined} {...dropProps}>
                {inputs}
                <div className={styles.emptyArt} aria-hidden>
                    <Shape name="cookie9" size={96} className={styles.emptyShape} />
                    <span className={styles.emptyIcon}>{busy ? <LoadingIndicator size={40} /> : icons.addPhoto}</span>
                </div>
                <div className={styles.emptyActions}>
                    <Button variant="tonal" size="s" icon={icons.image} onClick={pick} disabled={busy}>
                        Add photo
                    </Button>
                    {canCapture && (
                        <Button variant="outlined" size="s" icon={icons.camera} onClick={shoot} disabled={busy}>
                            Take photo
                        </Button>
                    )}
                </div>
                {!canCapture && <p className={styles.hint}>Drop or paste an image</p>}
            </div>
        )
    }

    return (
        <div className={styles.filled} data-over={over || undefined} aria-busy={busy || undefined} {...dropProps}>
            {inputs}
            {/* biome-ignore lint/performance/noImgElement: data and blob URLs, plus remote photos already sized by the server */}
            <img className={styles.image} src={photo.src} alt={alt ? `Photo of ${alt}` : 'Recipe photo'} />
            {busy && (
                <div className={styles.busy}>
                    <LoadingIndicator contained label="Preparing photo" />
                </div>
            )}
            <div className={styles.overlay}>
                {canCapture && (
                    <IconButton
                        variant="tonal"
                        label="Take photo"
                        icon={icons.camera}
                        onClick={shoot}
                        disabled={busy}
                    />
                )}
                <IconButton variant="tonal" label="Change photo" icon={icons.image} onClick={pick} disabled={busy} />
                <IconButton variant="tonal" label="Remove photo" icon={icons.delete} onClick={remove} disabled={busy} />
            </div>
        </div>
    )
}
