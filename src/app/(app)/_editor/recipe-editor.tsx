'use client'

import { type FormEvent, useEffect, useId, useRef, useState, useTransition } from 'react'
import { createRecipe, updateRecipe } from '@/actions/recipes'
import { useThemePreference } from '@/components/theme/theme-provider'
import { Button } from '@/components/ui/button'
import { ChipSet, FilterChip } from '@/components/ui/chip'
import { AlertDialog, AlertDialogClose, AlertDialogContent } from '@/components/ui/dialog'
import { IconButton } from '@/components/ui/icon-button'
import { useSnackbar } from '@/components/ui/snackbar'
import { TextField } from '@/components/ui/text-field'
import { TopAppBar } from '@/components/ui/top-app-bar'
import { useViewTransitionRouter } from '@/components/ui/view-transition'
import { LIMITS } from '@/lib/domain/types'
import { formatMinutes, parseDurationToMinutes } from '@/lib/recipe/time'
import type { EditorIcons } from './icons'
import { LineList, type LinesUpdate } from './line-list'
import { previousPath } from './navigation'
import { photoColorCss, seedFromPhoto } from './photo'
import { PhotoField } from './photo-field'
import styles from './recipe-editor.module.scss'
import { TagField } from './tag-field'
import { useUnsavedGuard } from './use-unsaved-guard'
import {
    EDITOR_SCOPE,
    type EditorCollection,
    type EditorLine,
    type EditorPhoto,
    type EditorValues,
    snapshot,
    toFormData,
} from './values'

export interface RecipeEditorProps {
    /** Present when editing a saved recipe. */
    recipeId?: string
    heading: string
    initial: EditorValues
    initialPhoto: EditorPhoto
    /** Server-rendered dynamic color for the initial photo, scoped to `[data-editor]`. */
    initialColorCss?: string
    tags: string[]
    collections: EditorCollection[]
    icons: EditorIcons
    /** Where Close goes when there is no in-app page to go back to. */
    closeHref: string
    /** Replaces the default Close behavior (the clip flow returns to its review). */
    onClose?: () => void
    /** Counts the initial values as an edit (an unsaved clip is work worth guarding). */
    startDirty?: boolean
}

const TIME_SUGGESTIONS = ['5 min', '10 min', '15 min', '20 min', '30 min', '45 min', '1 hr', '1 hr 30 min', '2 hr']

function withBlankRow(lines: EditorLine[], prefix: string): EditorLine[] {
    return lines.length ? lines : [{ id: `${prefix}0`, text: '', heading: false }]
}

/** The one recipe editor: /new, /recipe/[id]/edit and the clip flow's Edit details. */
export function RecipeEditor({
    recipeId,
    heading,
    initial,
    initialPhoto,
    initialColorCss = '',
    tags: tagSuggestions,
    collections,
    icons,
    closeHref,
    onClose,
    startDirty = false,
}: RecipeEditorProps) {
    const router = useViewTransitionRouter()
    const snackbar = useSnackbar()
    const { contrast } = useThemePreference()
    const timesId = useId()
    const formRef = useRef<HTMLFormElement>(null)
    const [values, setValues] = useState<EditorValues>(() => ({
        ...initial,
        ingredients: withBlankRow(initial.ingredients, 'i'),
        instructions: withBlankRow(initial.instructions, 's'),
    }))
    const [photo, setPhoto] = useState<EditorPhoto>(initialPhoto)
    const [baseline] = useState(() => (startDirty ? '' : snapshot(initial, initialPhoto)))
    const [titleError, setTitleError] = useState<string | undefined>()
    const [colorCss, setColorCss] = useState(initialColorCss)
    const [saving, startSaving] = useTransition()
    const savedId = useRef<string | null>(null)

    const dirty = snapshot(values, photo) !== baseline
    const guard = useUnsavedGuard(dirty)

    // Re-tint the editor from a new photo; the server already did the initial one.
    const photoSrc = photo.kind === 'none' ? '' : photo.src
    const initialSrc = initialPhoto.kind === 'none' ? '' : initialPhoto.src
    useEffect(() => {
        if (!photoSrc) {
            setColorCss('')
            return
        }
        if (photoSrc === initialSrc && initialColorCss) {
            setColorCss(initialColorCss)
            return
        }
        let cancelled = false
        void seedFromPhoto(photoSrc).then(async (seed) => {
            if (cancelled || seed === null) return
            const css = await photoColorCss(EDITOR_SCOPE, seed, contrast)
            if (!cancelled) setColorCss(css)
        })
        return () => {
            cancelled = true
        }
    }, [photoSrc, initialSrc, initialColorCss, contrast])

    function set<K extends keyof EditorValues>(key: K, value: EditorValues[K]) {
        setValues((v) => ({ ...v, [key]: value }))
    }

    const setIngredients: LinesUpdate = (update) => setValues((v) => ({ ...v, ingredients: update(v.ingredients) }))
    const setInstructions: LinesUpdate = (update) => setValues((v) => ({ ...v, instructions: update(v.instructions) }))

    function leave() {
        if (onClose) {
            onClose()
            return
        }
        if (previousPath()) router.back()
        else router.replace(closeHref, 'back')
    }

    function requestClose() {
        if (dirty && !savedId.current) guard.ask('')
        else leave()
    }

    function discard() {
        const href = guard.pendingHref
        guard.release()
        if (href) router.push(href, 'fade')
        else leave()
    }

    function save() {
        if (saving) return
        if (!values.title.trim()) {
            setTitleError('Add a title.')
            formRef.current?.querySelector<HTMLInputElement>('input[name="title"]')?.focus()
            return
        }
        startSaving(async () => {
            const fd = toFormData(values, photo, initialPhoto)
            let result: Awaited<ReturnType<typeof createRecipe>>
            try {
                result = recipeId ? await updateRecipe(recipeId, fd) : await createRecipe(fd)
            } catch {
                result = {
                    ok: false,
                    error: navigator.onLine
                        ? 'Could not save. Try again.'
                        : 'You are offline. Save again when connected.',
                }
            }
            if (!result.ok) {
                if (result.code === 'invalid_title') setTitleError(result.error)
                snackbar({ message: result.error, urgent: true, action: 'Retry', onAction: save })
                return
            }
            savedId.current = result.data
            guard.release()
            const href = `/recipe/${result.data}`
            if (recipeId && previousPath() === href) router.back()
            else router.replace(href, 'forward')
        })
    }

    // Cmd/Ctrl+S saves from anywhere in the editor.
    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 's') {
                event.preventDefault()
                save()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    })

    function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        // Enter in a single-line field should not save and leave the page.
        if ((event.nativeEvent as SubmitEvent).submitter) save()
    }

    const prepMin = parseDurationToMinutes(values.prepTime)
    const cookMin = parseDurationToMinutes(values.cookTime)
    const sum = (prepMin ?? 0) + (cookMin ?? 0)
    const totalHint = !values.totalTime.trim() && sum > 0 ? formatMinutes(sum) : undefined

    return (
        <div className={styles.editor} data-editor="">
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: generated color roles, no user text */}
            {colorCss && <style dangerouslySetInnerHTML={{ __html: colorCss }} />}
            <form ref={formRef} className={styles.form} onSubmit={onSubmit} noValidate aria-label={heading}>
                <TopAppBar
                    title={heading}
                    leading={<IconButton label="Close" icon={icons.close} onClick={requestClose} />}
                    trailing={
                        <Button type="submit" size="s" loading={saving} className={styles.save}>
                            Save
                        </Button>
                    }
                />
                <div className={styles.body}>
                    <div className={styles.core}>
                        <PhotoField photo={photo} onChange={setPhoto} icons={icons} alt={values.title} />
                        <TextField
                            name="title"
                            label="Title"
                            variant="outlined"
                            value={values.title}
                            maxLength={LIMITS.title}
                            required
                            autoComplete="off"
                            enterKeyHint="next"
                            error={titleError}
                            onChange={(e) => {
                                set('title', e.currentTarget.value)
                                if (titleError && e.currentTarget.value.trim()) setTitleError(undefined)
                            }}
                        />
                        <TextField
                            label="Description"
                            variant="outlined"
                            multiline
                            rows={2}
                            maxRows={8}
                            value={values.description}
                            maxLength={LIMITS.shortText}
                            onChange={(e) => set('description', e.currentTarget.value)}
                        />
                        <div className={styles.times}>
                            <TextField
                                label="Servings"
                                variant="outlined"
                                value={values.servings}
                                maxLength={40}
                                inputMode="text"
                                autoComplete="off"
                                onChange={(e) => set('servings', e.currentTarget.value)}
                            />
                            <TextField
                                label="Prep time"
                                variant="outlined"
                                value={values.prepTime}
                                maxLength={60}
                                list={timesId}
                                autoComplete="off"
                                onChange={(e) => set('prepTime', e.currentTarget.value)}
                            />
                            <TextField
                                label="Cook time"
                                variant="outlined"
                                value={values.cookTime}
                                maxLength={60}
                                list={timesId}
                                autoComplete="off"
                                onChange={(e) => set('cookTime', e.currentTarget.value)}
                            />
                            <TextField
                                label="Total time"
                                variant="outlined"
                                value={values.totalTime}
                                maxLength={60}
                                list={timesId}
                                autoComplete="off"
                                placeholder={totalHint}
                                onChange={(e) => set('totalTime', e.currentTarget.value)}
                            />
                            <datalist id={timesId}>
                                {(totalHint ? [totalHint, ...TIME_SUGGESTIONS] : TIME_SUGGESTIONS).map((t) => (
                                    <option key={t} value={t} />
                                ))}
                            </datalist>
                        </div>
                    </div>

                    <div className={styles.lists}>
                        <LineList
                            kind="ingredient"
                            lines={values.ingredients}
                            onChange={setIngredients}
                            icons={icons}
                        />
                        <LineList kind="step" lines={values.instructions} onChange={setInstructions} icons={icons} />
                    </div>

                    <div className={styles.extra}>
                        <TextField
                            label="Notes"
                            variant="outlined"
                            multiline
                            rows={3}
                            maxRows={14}
                            value={values.notes}
                            maxLength={LIMITS.longText}
                            onChange={(e) => set('notes', e.currentTarget.value)}
                        />
                        <TagField
                            value={values.tags}
                            onChange={(t) => set('tags', t)}
                            suggestions={tagSuggestions}
                            icons={icons}
                        />
                        {collections.length > 0 && (
                            <fieldset className={styles.group}>
                                <legend className={styles.groupLabel}>
                                    <span className={styles.groupIcon}>{icons.collection}</span>
                                    Collections
                                </legend>
                                <ChipSet>
                                    {collections.map((c) => (
                                        <FilterChip
                                            key={c.id}
                                            selected={values.collectionIds.includes(c.id)}
                                            onSelectedChange={(on) =>
                                                set(
                                                    'collectionIds',
                                                    on
                                                        ? [...values.collectionIds, c.id]
                                                        : values.collectionIds.filter((id) => id !== c.id),
                                                )
                                            }
                                        >
                                            {c.name}
                                        </FilterChip>
                                    ))}
                                </ChipSet>
                            </fieldset>
                        )}
                        <fieldset className={styles.group}>
                            <legend className={styles.groupLabel}>
                                <span className={styles.groupIcon}>{icons.link}</span>
                                Source
                            </legend>
                            <div className={styles.source}>
                                <TextField
                                    label="Link"
                                    variant="outlined"
                                    type="url"
                                    inputMode="url"
                                    autoComplete="url"
                                    value={values.sourceUrl}
                                    maxLength={2048}
                                    onChange={(e) => set('sourceUrl', e.currentTarget.value)}
                                />
                                <TextField
                                    label="Site name"
                                    variant="outlined"
                                    value={values.sourceName}
                                    maxLength={200}
                                    autoComplete="off"
                                    onChange={(e) => set('sourceName', e.currentTarget.value)}
                                />
                            </div>
                        </fieldset>
                    </div>
                </div>
            </form>

            <AlertDialog open={guard.pendingHref !== null} onOpenChange={(open) => !open && guard.cancel()}>
                <AlertDialogContent
                    headline="Discard changes?"
                    actions={
                        <>
                            <AlertDialogClose render={<Button variant="text" />}>Keep editing</AlertDialogClose>
                            <Button variant="text" onClick={discard}>
                                Discard
                            </Button>
                        </>
                    }
                />
            </AlertDialog>
        </div>
    )
}
