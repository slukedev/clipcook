'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import styles from '@/styles/Home.module.scss'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { Main } from '@/components/main'
import { Modal } from '@/components/modal'
import { Ripple } from '@/components/ripple'
import { Spinner } from '@/components/spinner'
import { Textarea } from '@/components/textarea'
import {
    createRecipeAction,
    deleteRecipeAction,
    importRecipeAction,
    updateRecipeAction,
} from './actions'

function ordinal(n: number): string {
    const v = n % 100
    const suffixes = ['th', 'st', 'nd', 'rd']
    const suffix = suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]
    return `${n}${suffix}`
}

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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export function RecipeForm({ mode, recipeId, initial }: RecipeFormProps) {
    const router = useRouter()
    const [values, setValues] = useState<RecipeFormValues>(initial ?? BLANK)
    const [saving, setSaving] = useState<false | 'creating' | 'updating' | 'deleting'>(false)
    const [importOpen, setImportOpen] = useState(false)
    const [importing, setImporting] = useState(false)
    const [importUrl, setImportUrl] = useState('')
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const fileRef = useRef<HTMLInputElement | null>(null)

    function setField<K extends keyof RecipeFormValues>(key: K, value: RecipeFormValues[K]) {
        setValues((prev) => ({ ...prev, [key]: value }))
    }

    function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        if (!file.type.startsWith('image/')) {
            setError('Please choose an image file.')
            return
        }
        if (file.size > MAX_IMAGE_BYTES) {
            setError('Image is too large (max 5 MB).')
            return
        }
        const reader = new FileReader()
        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : ''
            if (result) setField('image', result)
        }
        reader.onerror = () => setError('Could not read that image.')
        reader.readAsDataURL(file)
    }

    async function onImport(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!importUrl) return
        setImporting(true)
        setError(null)
        const result = await importRecipeAction(importUrl)
        setImporting(false)
        if (!result.ok) {
            setError(result.error)
            return
        }
        const imported = result.data
        setValues((prev) => ({
            ...prev,
            image: imported.image ?? prev.image,
            title: imported.title ?? prev.title,
            description: imported.description ?? prev.description,
            servings: imported.servings ?? prev.servings,
            prepTime: imported.prepTime ?? prev.prepTime,
            cookTime: imported.cookTime ?? prev.cookTime,
            totalTime: imported.totalTime ?? prev.totalTime,
            ingredients:
                imported.ingredients && imported.ingredients.length > 0
                    ? imported.ingredients
                    : prev.ingredients,
            instructions:
                imported.instructions && imported.instructions.length > 0
                    ? imported.instructions
                    : prev.instructions,
            notes: prev.notes || `Clipped from ${importUrl}\n`,
        }))
        setImportOpen(false)
        setImportUrl('')
    }

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError(null)

        const finalIngredients = values.ingredients.map((s) => s.trim()).filter((s) => s.length > 0)
        const finalInstructions = values.instructions.map((s) => s.trim()).filter((s) => s.length > 0)

        if (!values.image) {
            setError('Please upload an image.')
            return
        }
        if (finalIngredients.length === 0) {
            setError('Please add at least one ingredient.')
            return
        }
        if (finalInstructions.length === 0) {
            setError('Please add at least one step.')
            return
        }

        const payload = { ...values, ingredients: finalIngredients, instructions: finalInstructions }

        setSaving(mode === 'create' ? 'creating' : 'updating')
        const result =
            mode === 'create'
                ? await createRecipeAction(payload)
                : await updateRecipeAction(recipeId ?? '', payload)
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
        if (!recipeId) return
        setDeleteOpen(false)
        setSaving('deleting')
        startTransition(async () => {
            const result = await deleteRecipeAction(recipeId)
            if (result && result.ok === false) {
                setSaving(false)
                setError(result.error)
            }
        })
    }

    const busy = saving !== false || isPending

    if (saving === 'creating' || saving === 'updating' || saving === 'deleting') {
        return (
            <Main pageName="create">
                <div className={styles.loading} style={{ marginTop: 25 }}>
                    <h1>{saving === 'creating' ? 'Creating' : saving === 'updating' ? 'Saving' : 'Deleting'}</h1>
                    <Spinner />
                    <p>Belle is going to love this! (except if it is sardines in spaghetti)</p>
                </div>
            </Main>
        )
    }

    return (
        <Main pageName="create">
            <form onSubmit={onSubmit}>
                <h1>{mode === 'create' ? 'Create a recipe' : 'Edit a recipe'}</h1>

                {mode === 'create' ? (
                    <Button type="button" onClick={() => setImportOpen(true)}>
                        Autoimport from URL
                    </Button>
                ) : (
                    <Button type="button" onClick={() => setDeleteOpen(true)}>
                        Delete Recipe
                    </Button>
                )}

                <h2>Recipe Information</h2>

                <div className={styles.imageUploadContainer}>
                    <Ripple feather="25px" speedms={500}>
                        <button
                            type="button"
                            className={styles.imageUploadButton}
                            onClick={() => fileRef.current?.click()}
                        >
                            {values.image ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img style={{ width: '101%' }} src={values.image} alt="Recipe" />
                            ) : (
                                <span>Upload Image</span>
                            )}
                        </button>
                    </Ripple>
                </div>

                <input
                    ref={fileRef}
                    onChange={onFilePicked}
                    style={{ display: 'none' }}
                    hidden
                    type="file"
                    accept="image/*"
                    name="image"
                    id="image"
                />

                <div className={styles.createInputs}>
                    <div className={styles.inputGroup}>
                        <Input
                            id="title"
                            fullwidth
                            label="Recipe Title"
                            placeholder="Ex: Meats"
                            type="text"
                            name="title"
                            icon="title"
                            autoComplete="off"
                            value={values.title}
                            onChange={(e) => setField('title', e.currentTarget.value)}
                            required
                        />
                        <Input
                            id="servings"
                            label="Servings"
                            placeholder="Ex: 10"
                            type="number"
                            name="servings"
                            icon="people"
                            autoComplete="off"
                            min={1}
                            max={1000}
                            value={values.servings}
                            onChange={(e) => setField('servings', e.currentTarget.value)}
                            required
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <Textarea
                            id="description"
                            fullwidth
                            label="Recipe Description"
                            placeholder="Ex: A good thing"
                            name="description"
                            icon="description"
                            autoComplete="off"
                            value={values.description}
                            onChange={(e) => setField('description', e.currentTarget.value)}
                            required
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <Input
                            fullwidth
                            id="prepTime"
                            label="Prep Time"
                            placeholder="Ex: 10 minutes"
                            type="text"
                            name="prepTime"
                            icon="timer"
                            autoComplete="off"
                            value={values.prepTime}
                            onChange={(e) => setField('prepTime', e.currentTarget.value)}
                            required
                        />
                        <Input
                            fullwidth
                            id="cookTime"
                            label="Cook Time"
                            placeholder="Ex: 10 minutes"
                            type="text"
                            name="cookTime"
                            icon="timer"
                            autoComplete="off"
                            value={values.cookTime}
                            onChange={(e) => setField('cookTime', e.currentTarget.value)}
                            required
                        />
                        <Input
                            fullwidth
                            id="totalTime"
                            label="Total Time"
                            placeholder="Ex: 10 minutes"
                            type="text"
                            name="totalTime"
                            icon="timer"
                            autoComplete="off"
                            value={values.totalTime}
                            onChange={(e) => setField('totalTime', e.currentTarget.value)}
                            required
                        />
                    </div>
                    <Textarea
                        id="notes"
                        fullwidth
                        label="Recipe Notes"
                        placeholder="Optional"
                        name="notes"
                        icon="notes"
                        autoComplete="off"
                        value={values.notes}
                        onChange={(e) => setField('notes', e.currentTarget.value)}
                    />
                </div>

                <h2>Ingredients {mode === 'create' ? '(Please use decimals instead of fractions)' : ''}</h2>
                <div className={styles.createInputs}>
                    {values.ingredients.map((ingredient, index) => (
                        <Input
                            key={index}
                            id={`ingredient-${index}`}
                            name={`ingredient-${index}`}
                            label="Ingredient"
                            placeholder="Ex: 1 cup of flour"
                            type="text"
                            icon="icecream"
                            autoComplete="off"
                            value={ingredient}
                            onChange={(e) =>
                                setValues((prev) => {
                                    const next = [...prev.ingredients]
                                    next[index] = e.currentTarget.value
                                    return { ...prev, ingredients: next }
                                })
                            }
                        />
                    ))}
                    <Button
                        type="button"
                        onClick={() => setValues((prev) => ({ ...prev, ingredients: [...prev.ingredients, ''] }))}
                    >
                        Add Ingredient
                    </Button>
                </div>

                <h2>Instructions</h2>
                <div className={styles.createInputs}>
                    {values.instructions.map((instruction, index) => (
                        <Input
                            key={index}
                            id={`instruction-${index}`}
                            name={`instruction-${index}`}
                            fullwidth
                            label={`${ordinal(index + 1)} step`}
                            placeholder="Ex: Mix the flour"
                            type="text"
                            icon="task"
                            autoComplete="off"
                            value={instruction}
                            onChange={(e) =>
                                setValues((prev) => {
                                    const next = [...prev.instructions]
                                    next[index] = e.currentTarget.value
                                    return { ...prev, instructions: next }
                                })
                            }
                        />
                    ))}
                    <Button
                        type="button"
                        onClick={() => setValues((prev) => ({ ...prev, instructions: [...prev.instructions, ''] }))}
                    >
                        Add Step
                    </Button>
                </div>

                {error ? <p style={{ color: 'var(--error)' }}>{error}</p> : null}

                <div className={styles.createDiv}>
                    <Button disabled={busy} type="submit">
                        {mode === 'create' ? 'Create Recipe!' : 'Save Changes!'}
                    </Button>
                </div>
            </form>

            <Modal
                opened={importOpen}
                title="Clip URL"
                closefunction={() => (importing ? undefined : setImportOpen(false))}
            >
                <form onSubmit={onImport}>
                    {importing ? (
                        <div style={{ display: 'block', marginLeft: 'auto', marginRight: 'auto', width: 'fit-content' }}>
                            <Spinner />
                        </div>
                    ) : (
                        <>
                            <Input
                                type="url"
                                label="URL"
                                name="url"
                                id="clipurl"
                                icon="attachment"
                                fullwidth
                                autoComplete="off"
                                value={importUrl}
                                onChange={(e) => setImportUrl(e.currentTarget.value)}
                                required
                            />
                            <div style={{ width: '100%', height: 24 }} />
                            <Button type="submit">Clip</Button>
                        </>
                    )}
                </form>
            </Modal>

            <Modal opened={deleteOpen} title="Delete Recipe" closefunction={() => setDeleteOpen(false)}>
                <p>Are you sure you want to delete this recipe?</p>
                <p style={{ color: 'var(--error)' }}>THIS ACTION IS PERMANENT AND CANNOT BE UNDONE</p>
                <Button type="button" onClick={onDelete}>
                    Delete Recipe
                </Button>
            </Modal>
        </Main>
    )
}
