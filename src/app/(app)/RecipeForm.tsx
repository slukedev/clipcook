'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react'
import {
    AlertDialog,
    AlertDialogActions,
    AlertDialogBody,
    AlertDialogClose,
    AlertDialogContent,
    AlertDialogHeadline,
    AlertDialogTrigger,
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogClose,
    DialogContent,
    DialogHeadline,
    DialogTrigger,
    Icon,
    IconButton,
    LinearProgress,
    TextField,
} from '@/components/ui'
import { createRecipeAction, deleteRecipeAction, importRecipeAction, updateRecipeAction } from './actions'
import styles from './recipe-form.module.scss'

export interface RecipeFormValues {
    image: string
    title: string
    description: string
    servings: string
    prepTime: string
    cookTime: string
    totalTime: string
    notes: string
    ingredients: string[]
    instructions: string[]
}

interface RecipeFormProps {
    mode: 'create' | 'edit'
    recipeId?: string
    initial?: RecipeFormValues
}

const BLANK: RecipeFormValues = {
    image: '',
    title: '',
    description: '',
    servings: '',
    prepTime: '',
    cookTime: '',
    totalTime: '',
    notes: '',
    ingredients: [''],
    instructions: [''],
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
/** Above this edge the photo is downscaled client-side to bound the upload. */
const PRE_RESIZE_EDGE = 2560
// Client-side caps mirror the server schema (schemas.ts) so people hit a
// gentle input limit instead of a rejected save.
const MAX_TINY = 200
const MAX_SHORT = 2000
const MAX_LONG = 10_000
const MAX_LIST_ITEMS = 100
const OFFLINE_MESSAGE = 'Couldn’t reach ClipCook — check your connection and try again.'

async function preResize(file: File): Promise<File> {
    if (file.size < 2 * 1024 * 1024) return file
    try {
        const bitmap = await createImageBitmap(file)
        const { width, height } = bitmap
        if (Math.max(width, height) <= PRE_RESIZE_EDGE) {
            bitmap.close()
            return file
        }
        const ratio = PRE_RESIZE_EDGE / Math.max(width, height)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(width * ratio)
        canvas.height = Math.round(height * ratio)
        const ctx = canvas.getContext('2d')
        if (!ctx) return file
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        bitmap.close()
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
        if (!blob) return file
        return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
    } catch {
        // The server pipeline validates and resizes anyway.
        return file
    }
}

function ListEditor({
    label,
    addLabel,
    items,
    numbered,
    multiline,
    onChange,
}: {
    label: string
    addLabel: string
    items: string[]
    numbered?: boolean
    multiline?: boolean
    onChange: (items: string[]) => void
}) {
    const setItem = (index: number, value: string) => {
        const next = [...items]
        next[index] = value
        onChange(next)
    }
    const removeItem = (index: number) => {
        onChange(items.length > 1 ? items.filter((_, i) => i !== index) : [''])
    }
    const move = (index: number, direction: -1 | 1) => {
        const target = index + direction
        if (target < 0 || target >= items.length) return
        const next = [...items]
        const a = next[index] as string
        next[index] = next[target] as string
        next[target] = a
        onChange(next)
    }

    return (
        <div className={styles.listEditor}>
            {items.map((item, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional by design
                <div key={index} className={styles.listRow}>
                    {numbered && <span className={styles.listOrdinal}>{index + 1}</span>}
                    <TextField
                        label={`${label} ${index + 1}`}
                        value={item}
                        multiline={multiline}
                        rows={2}
                        onChange={(event) => setItem(index, event.target.value)}
                        fullWidth
                        className={styles.listField}
                    />
                    <div className={styles.listRowActions}>
                        <IconButton
                            icon="arrow_upward"
                            label="Move up"
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                        />
                        <IconButton
                            icon="arrow_downward"
                            label="Move down"
                            disabled={index === items.length - 1}
                            onClick={() => move(index, 1)}
                        />
                        <IconButton icon="close" label="Remove" onClick={() => removeItem(index)} />
                    </div>
                </div>
            ))}
            <Button variant="text" icon="add" onClick={() => onChange([...items, ''])} className={styles.addButton}>
                {addLabel}
            </Button>
        </div>
    )
}

export function RecipeForm({ mode, recipeId, initial }: RecipeFormProps) {
    const router = useRouter()
    const [values, setValues] = useState<RecipeFormValues>(initial ?? BLANK)
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string>(initial?.image ?? '')
    const [importUrl, setImportUrl] = useState('')
    const [importOpen, setImportOpen] = useState(false)
    const [importing, setImporting] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const fileRef = useRef<HTMLInputElement | null>(null)
    const photoInputId = useId()

    // Revoke object URLs when the preview changes away from them.
    useEffect(() => {
        return () => {
            if (photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
        }
    }, [photoPreview])

    function setField<K extends keyof RecipeFormValues>(key: K, value: RecipeFormValues[K]) {
        setValues((prev) => ({ ...prev, [key]: value }))
    }

    async function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        if (!file.type.startsWith('image/')) {
            setError('Please choose an image file.')
            return
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            setError('Image is too large, please pick something under 25 MB.')
            return
        }
        setError(null)
        const resized = await preResize(file)
        setPhotoFile(resized)
        setPhotoDataUrl(null)
        setPhotoPreview(URL.createObjectURL(resized))
    }

    async function onImport(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!importUrl || importing) return
        setImporting(true)
        setError(null)
        const result = await importRecipeAction(importUrl)
        setImporting(false)
        if (!result.ok) {
            setError(result.error)
            return
        }
        const imported = result.data
        if (imported.image) {
            setPhotoDataUrl(imported.image)
            setPhotoFile(null)
            setPhotoPreview(imported.image)
        }
        setValues((prev) => ({
            ...prev,
            title: imported.title ?? prev.title,
            description: imported.description ?? prev.description,
            servings: imported.servings !== undefined ? String(imported.servings) : prev.servings,
            prepTime: imported.prepTime ?? prev.prepTime,
            cookTime: imported.cookTime ?? prev.cookTime,
            totalTime: imported.totalTime ?? prev.totalTime,
            ingredients:
                imported.ingredients && imported.ingredients.length > 0 ? imported.ingredients : prev.ingredients,
            instructions:
                imported.instructions && imported.instructions.length > 0 ? imported.instructions : prev.instructions,
            notes: prev.notes || `Clipped from ${importUrl}\n`,
        }))
        setImportOpen(false)
        setImportUrl('')
    }

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (saving) return
        setError(null)

        const ingredients = values.ingredients.map((s) => s.trim()).filter(Boolean)
        const instructions = values.instructions.map((s) => s.trim()).filter(Boolean)

        if (!photoPreview) {
            setError('Add a photo for your recipe.')
            return
        }
        if (ingredients.length === 0) {
            setError('Add at least one ingredient.')
            return
        }
        if (instructions.length === 0) {
            setError('Add at least one step.')
            return
        }

        const formData = new FormData()
        formData.set('title', values.title)
        formData.set('description', values.description)
        formData.set('servings', values.servings)
        formData.set('prepTime', values.prepTime)
        formData.set('cookTime', values.cookTime)
        formData.set('totalTime', values.totalTime)
        formData.set('notes', values.notes)
        formData.set('ingredients', JSON.stringify(ingredients))
        formData.set('instructions', JSON.stringify(instructions))
        if (photoFile) formData.set('photo', photoFile)
        else if (photoDataUrl) formData.set('photoDataUrl', photoDataUrl)

        setSaving(true)
        const result =
            mode === 'create' ? await createRecipeAction(formData) : await updateRecipeAction(recipeId ?? '', formData)
        if (!result.ok) {
            setSaving(false)
            setError(result.error)
            return
        }
        startTransition(() => {
            router.push(`/recipe/${result.data}`)
            router.refresh()
        })
    }

    function onDelete() {
        if (!recipeId || saving) return
        setSaving(true)
        startTransition(async () => {
            const result = await deleteRecipeAction(recipeId)
            if (result && result.ok === false) {
                setSaving(false)
                setError(result.error)
            }
        })
    }

    const busy = saving || isPending

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1 className={styles.headline}>{mode === 'create' ? 'New recipe' : 'Edit recipe'}</h1>
                {mode === 'create' && (
                    <Dialog open={importOpen} onOpenChange={setImportOpen}>
                        <DialogTrigger
                            render={
                                <Button variant="tonal" icon="wand_stars">
                                    Clip from URL
                                </Button>
                            }
                        />
                        <DialogContent>
                            <DialogHeadline>Clip a recipe</DialogHeadline>
                            <DialogBody>
                                Paste a link to any recipe page, the title, photo, ingredients, and steps fill in
                                automatically.
                            </DialogBody>
                            <form onSubmit={onImport}>
                                <TextField
                                    label="Recipe URL"
                                    placeholder="https://…"
                                    leadingIcon="link"
                                    value={importUrl}
                                    onChange={(event) => setImportUrl(event.target.value)}
                                    fullWidth
                                    type="url"
                                    autoComplete="off"
                                    className={styles.importField}
                                />
                                {importing && (
                                    <LinearProgress label="Clipping recipe" className={styles.importProgress} />
                                )}
                                <DialogActions>
                                    <DialogClose render={<Button variant="text">Cancel</Button>} />
                                    <Button type="submit" disabled={importing || !importUrl}>
                                        {importing ? 'Clipping…' : 'Clip it'}
                                    </Button>
                                </DialogActions>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </header>

            <form onSubmit={onSubmit} className={styles.form}>
                <input
                    ref={fileRef}
                    id={photoInputId}
                    type="file"
                    accept="image/*"
                    onChange={onFilePicked}
                    className={styles.fileInput}
                />
                <button
                    type="button"
                    className={styles.photoPicker}
                    onClick={() => fileRef.current?.click()}
                    aria-label={photoPreview ? 'Change photo' : 'Add a photo'}
                >
                    {photoPreview ? (
                        <>
                            {/* biome-ignore lint/performance/noImgElement: preview is a blob/data URL */}
                            <img src={photoPreview} alt="Recipe" className={styles.photoPreview} />
                            <span className={styles.photoBadge}>
                                <Icon name="photo_camera" size={20} />
                                Change photo
                            </span>
                        </>
                    ) : (
                        <span className={styles.photoEmpty}>
                            <Icon name="add_a_photo" size={36} />
                            <span>Add a photo</span>
                        </span>
                    )}
                </button>

                <div className={styles.fields}>
                    <TextField
                        label="Title"
                        value={values.title}
                        onChange={(event) => setField('title', event.target.value)}
                        required
                        fullWidth
                    />
                    <TextField
                        label="Description"
                        value={values.description}
                        onChange={(event) => setField('description', event.target.value)}
                        multiline
                        rows={2}
                        required
                        fullWidth
                    />
                    <div className={styles.metaGrid}>
                        <TextField
                            label="Servings"
                            value={values.servings}
                            onChange={(event) => setField('servings', event.target.value)}
                            leadingIcon="group"
                            required
                            fullWidth
                        />
                        <TextField
                            label="Prep time"
                            value={values.prepTime}
                            onChange={(event) => setField('prepTime', event.target.value)}
                            leadingIcon="restaurant"
                            required
                            fullWidth
                        />
                        <TextField
                            label="Cook time"
                            value={values.cookTime}
                            onChange={(event) => setField('cookTime', event.target.value)}
                            leadingIcon="oven_gen"
                            required
                            fullWidth
                        />
                        <TextField
                            label="Total time"
                            value={values.totalTime}
                            onChange={(event) => setField('totalTime', event.target.value)}
                            leadingIcon="schedule"
                            required
                            fullWidth
                        />
                    </div>
                </div>

                <section className={`${styles.section} ${styles.ingredientsArea}`}>
                    <h2 className={styles.sectionTitle}>Ingredients</h2>
                    <ListEditor
                        label="Ingredient"
                        addLabel="Add ingredient"
                        items={values.ingredients}
                        onChange={(items) => setField('ingredients', items)}
                    />
                </section>

                <section className={`${styles.section} ${styles.directionsArea}`}>
                    <h2 className={styles.sectionTitle}>Directions</h2>
                    <ListEditor
                        label="Step"
                        addLabel="Add step"
                        items={values.instructions}
                        numbered
                        multiline
                        onChange={(items) => setField('instructions', items)}
                    />
                </section>

                <section className={`${styles.section} ${styles.notesArea}`}>
                    <h2 className={styles.sectionTitle}>Notes</h2>
                    <TextField
                        label="Notes"
                        supportingText="Anything future-you should know, like substitutions, tweaks, where it came from."
                        value={values.notes}
                        onChange={(event) => setField('notes', event.target.value)}
                        multiline
                        rows={3}
                        fullWidth
                    />
                </section>

                {error && (
                    <p className={styles.error} role="alert">
                        <Icon name="error" size={18} />
                        {error}
                    </p>
                )}

                {busy && (
                    <LinearProgress
                        label={mode === 'create' ? 'Saving recipe' : 'Saving changes'}
                        className={styles.saveProgress}
                    />
                )}

                <div className={styles.footer}>
                    {mode === 'edit' && (
                        <AlertDialog>
                            <AlertDialogTrigger
                                render={
                                    <Button
                                        variant="text"
                                        icon="delete"
                                        className={styles.deleteButton}
                                        disabled={busy}
                                    >
                                        Delete
                                    </Button>
                                }
                            />
                            <AlertDialogContent>
                                <AlertDialogHeadline>Delete this recipe?</AlertDialogHeadline>
                                <AlertDialogBody>
                                    “{values.title || 'This recipe'}” will be permanently removed from your cookbook.
                                </AlertDialogBody>
                                <AlertDialogActions>
                                    <AlertDialogClose render={<Button variant="text">Cancel</Button>} />
                                    <AlertDialogClose
                                        render={
                                            <Button variant="text" onClick={onDelete}>
                                                Delete
                                            </Button>
                                        }
                                    />
                                </AlertDialogActions>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    <div className={styles.footerSpacer} />
                    <Button variant="text" onClick={() => router.back()} disabled={busy}>
                        Cancel
                    </Button>
                    <Button type="submit" icon="check" disabled={busy}>
                        {busy ? 'Saving…' : mode === 'create' ? 'Save recipe' : 'Save changes'}
                    </Button>
                </div>
            </form>
        </main>
    )
}
