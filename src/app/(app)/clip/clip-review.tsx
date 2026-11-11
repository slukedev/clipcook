'use client'

import { useEffect, useState, useTransition } from 'react'
import { flushSync } from 'react-dom'
import { createRecipe } from '@/actions/recipes'
import { useThemePreference } from '@/components/theme/theme-provider'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Shape } from '@/components/ui/shape'
import { useSnackbar } from '@/components/ui/snackbar'
import { TopAppBar } from '@/components/ui/top-app-bar'
import { SharedElement, TransitionLink, useViewTransitionRouter, vtName } from '@/components/ui/view-transition'
import type { ImportedRecipe } from '@/lib/domain/types'
import { type ReviewField, reviewChecks } from '@/lib/recipe/review-checks'
import { headingText, isHeadingLine } from '@/lib/recipe/text'
import type { EditorIcons } from '../_editor/icons'
import { photoColorCss, seedFromPhoto } from '../_editor/photo'
import { hostOf, toFormData, valuesFromImported } from '../_editor/values'
import styles from './clip-review.module.scss'
import { findDuplicate, type LibraryEntry } from './jobs'

interface ClipReviewProps {
    recipe: ImportedRecipe
    library: LibraryEntry[]
    icons: EditorIcons
    onEdit: () => void
    onExit: () => void
}

const SCOPE = '[data-clip-review]'
const STEP_SHAPES = ['cookie4', 'clover4', 'sunny', 'cookie6', 'gem', 'flower'] as const

/** What a clip found, in the recipe page's visual language, with Save one tap away. */
export function ClipReview({ recipe, library, icons, onEdit, onExit }: ClipReviewProps) {
    const router = useViewTransitionRouter()
    const snackbar = useSnackbar()
    const { contrast } = useThemePreference()
    const [saving, startSaving] = useTransition()
    const [savedId, setSavedId] = useState<string | null>(null)
    const [colorCss, setColorCss] = useState('')

    const title = recipe.title?.trim() || 'Untitled recipe'
    const duplicate = findDuplicate(library, { title, sourceUrl: recipe.sourceUrl })
    const host = recipe.sourceUrl ? hostOf(recipe.sourceUrl) : ''
    const sourceLabel = recipe.sourceName?.trim() || host
    const ingredients = recipe.ingredients ?? []
    const steps = recipe.instructions ?? []
    const checks = reviewChecks(recipe)
    const check = (field: ReviewField) => (checks.has(field) ? '' : undefined)
    const facts = (
        [
            { label: 'Servings', value: recipe.servings, field: 'servings' },
            { label: 'Prep', value: recipe.prepTime, field: 'prepTime' },
            { label: 'Cook', value: recipe.cookTime, field: 'cookTime' },
            { label: 'Total', value: recipe.totalTime, field: 'totalTime' },
        ] as const
    ).filter((f) => Boolean(f.value?.trim()))

    useEffect(() => {
        if (!recipe.image) return
        let cancelled = false
        void seedFromPhoto(recipe.image).then(async (seed) => {
            if (cancelled || seed === null) return
            const css = await photoColorCss(SCOPE, seed, contrast)
            if (!cancelled) setColorCss(css)
        })
        return () => {
            cancelled = true
        }
    }, [recipe.image, contrast])

    function save() {
        if (saving) return
        startSaving(async () => {
            const photo = recipe.image ? ({ kind: 'clipped', src: recipe.image } as const) : ({ kind: 'none' } as const)
            let result: Awaited<ReturnType<typeof createRecipe>>
            try {
                result = await createRecipe(toFormData(valuesFromImported(recipe), photo, { kind: 'none' }))
            } catch {
                result = {
                    ok: false,
                    error: navigator.onLine
                        ? 'Could not save. Try again.'
                        : 'You are offline. Save again when connected.',
                }
            }
            if (!result.ok) {
                snackbar({ message: result.error, urgent: true, action: 'Retry', onAction: save })
                return
            }
            const id = result.data
            // Name the photo and title before leaving so they morph into the recipe page.
            flushSync(() => setSavedId(id))
            router.replace(`/recipe/${id}`, 'forward')
        })
    }

    let stepNumber = 0
    const photoEl = recipe.image ? (
        // biome-ignore lint/performance/noImgElement: clipped photos are inline data URLs
        <img className={styles.photo} src={recipe.image} alt="" />
    ) : (
        <div className={styles.noPhoto} aria-hidden>
            <Shape name="cookie9" size="62%" className={styles.noPhotoShape} />
        </div>
    )

    return (
        <div className={styles.review} data-clip-review="">
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: generated color roles, no user text */}
            {colorCss && <style dangerouslySetInnerHTML={{ __html: colorCss }} />}
            <TopAppBar
                title=""
                titleAs="div"
                leading={<IconButton label="Close" icon={icons.close} onClick={onExit} />}
                trailing={
                    <div className={styles.barActions}>
                        <Button variant="tonal" size="s" icon={icons.edit} onClick={onEdit} className={styles.edit}>
                            <span className={styles.editLabel}>Edit details</span>
                        </Button>
                        <Button size="s" onClick={save} loading={saving}>
                            {duplicate ? 'Save copy' : 'Save'}
                        </Button>
                    </div>
                }
            />
            <article className={styles.body} aria-labelledby="clip-title">
                <div className={styles.notices}>
                    {duplicate && (
                        <div className={styles.duplicate} role="status">
                            <span className={styles.duplicateIcon}>{icons.library}</span>
                            <p className={styles.duplicateText}>Already in your library</p>
                            <Button
                                variant="text"
                                size="s"
                                render={<TransitionLink href={`/recipe/${duplicate.id}`} direction="forward" />}
                                nativeButton={false}
                            >
                                Open
                            </Button>
                        </div>
                    )}
                    {checks.size > 0 && (
                        <div className={styles.duplicate} role="status">
                            <span className={styles.duplicateIcon}>{icons.edit}</span>
                            <p className={styles.duplicateText} id="clip-checks">
                                Check the marked details
                            </p>
                            <Button variant="text" size="s" onClick={onEdit}>
                                Edit
                            </Button>
                        </div>
                    )}
                </div>

                <div className={styles.lead}>
                    <div className={styles.media}>
                        {savedId ? (
                            <SharedElement name={vtName('recipe-photo', savedId)}>{photoEl}</SharedElement>
                        ) : (
                            photoEl
                        )}
                    </div>

                    <header className={styles.header}>
                        {savedId ? (
                            <SharedElement name={vtName('recipe-title', savedId)}>
                                <h1 id="clip-title" className={styles.title}>
                                    {title}
                                </h1>
                            </SharedElement>
                        ) : (
                            <h1 id="clip-title" className={styles.title} data-check={check('title')}>
                                {title}
                            </h1>
                        )}
                        {recipe.sourceUrl && (
                            <a
                                className={styles.source}
                                href={recipe.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <span className={styles.sourceIcon}>{icons.openInNew}</span>
                                <span className={styles.sourceText}>{sourceLabel}</span>
                            </a>
                        )}
                        {recipe.description && <p className={styles.description}>{recipe.description}</p>}
                        {facts.length > 0 && (
                            <dl className={styles.facts}>
                                {facts.map((f) => (
                                    <div
                                        key={f.label}
                                        className={styles.fact}
                                        data-check={check(f.field)}
                                        aria-describedby={checks.has(f.field) ? 'clip-checks' : undefined}
                                    >
                                        <dt>{f.label}</dt>
                                        <dd>{f.value}</dd>
                                    </div>
                                ))}
                            </dl>
                        )}
                        {recipe.tags && recipe.tags.length > 0 && (
                            <ul className={styles.tags} aria-label="Tags">
                                {recipe.tags.map((t) => (
                                    <li key={t} className={styles.tag}>
                                        {t}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </header>

                    {ingredients.length > 0 && (
                        <section className={styles.ingredients} aria-labelledby="clip-ingredients">
                            <h2 id="clip-ingredients" className={styles.sectionTitle} data-check={check('ingredients')}>
                                Ingredients
                            </h2>
                            <ul className={styles.ingredientList}>
                                {ingredients.map((line, i) =>
                                    isHeadingLine(line) ? (
                                        // biome-ignore lint/suspicious/noArrayIndexKey: lines can repeat; order is the identity
                                        <li key={i} className={styles.subheading}>
                                            {headingText(line)}
                                        </li>
                                    ) : (
                                        // biome-ignore lint/suspicious/noArrayIndexKey: lines can repeat; order is the identity
                                        <li key={i} className={styles.ingredient}>
                                            {line}
                                        </li>
                                    ),
                                )}
                            </ul>
                        </section>
                    )}
                </div>

                {steps.length > 0 && (
                    <section className={styles.steps} aria-labelledby="clip-steps">
                        <h2 id="clip-steps" className={styles.sectionTitle} data-check={check('steps')}>
                            Steps
                        </h2>
                        <ol className={styles.stepList}>
                            {steps.map((line, i) => {
                                if (isHeadingLine(line)) {
                                    return (
                                        // biome-ignore lint/suspicious/noArrayIndexKey: lines can repeat; order is the identity
                                        <li key={i} className={styles.subheading}>
                                            {headingText(line)}
                                        </li>
                                    )
                                }
                                stepNumber += 1
                                const shape = STEP_SHAPES[(stepNumber - 1) % STEP_SHAPES.length] ?? 'cookie4'
                                return (
                                    // biome-ignore lint/suspicious/noArrayIndexKey: lines can repeat; order is the identity
                                    <li key={i} className={styles.step}>
                                        <span className={styles.stepNumber} aria-hidden>
                                            <Shape name={shape} size={40} className={styles.stepShape} />
                                            <span className={styles.stepDigit}>{stepNumber}</span>
                                        </span>
                                        <p className={styles.stepText}>{line}</p>
                                    </li>
                                )
                            })}
                        </ol>
                    </section>
                )}

                {recipe.notes && (
                    <section className={styles.notes} aria-labelledby="clip-notes">
                        <h2 id="clip-notes" className={styles.sectionTitle}>
                            Notes
                        </h2>
                        <p className={styles.notesText}>{recipe.notes}</p>
                    </section>
                )}
            </article>
        </div>
    )
}
