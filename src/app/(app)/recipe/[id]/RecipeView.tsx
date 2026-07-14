'use client'

import Qty, { getAliases } from 'js-quantities'
import { useEffect, useMemo, useState } from 'react'
import { RecipeImage } from '@/components/recipe-image'
import {
    BottomSheet,
    BottomSheetContent,
    BottomSheetTitle,
    BottomSheetTrigger,
    Button,
    Chip,
    Fab,
    Icon,
    IconButton,
    Ripple,
    TextField,
} from '@/components/ui'
import { displayIngredient, formatFraction, unescapeHtml } from '@/lib/recipe-format'
import type { Recipe } from '@/server/recipes'
import styles from './recipe-view.module.scss'

interface ConversionResult {
    value: number
    unit: string
}

function useWakeLock() {
    useEffect(() => {
        const wakeLock = navigator.wakeLock
        if (!wakeLock) return
        let sentinel: WakeLockSentinel | null = null
        let disposed = false

        const acquire = () => {
            if (disposed || document.visibilityState !== 'visible') return
            wakeLock
                .request('screen')
                .then((s) => {
                    sentinel = s
                })
                .catch(() => null)
        }

        acquire()
        document.addEventListener('visibilitychange', acquire)
        return () => {
            disposed = true
            document.removeEventListener('visibilitychange', acquire)
            sentinel?.release().catch(() => null)
        }
    }, [])
}

function ChecklistRow({
    checked,
    onToggle,
    children,
    ordinal,
}: {
    checked: boolean
    onToggle: () => void
    children: React.ReactNode
    ordinal?: number
}) {
    return (
        <li>
            <button
                type="button"
                className={styles.row}
                data-checked={checked || undefined}
                aria-pressed={checked}
                onClick={onToggle}
            >
                {ordinal !== undefined && (
                    <span className={styles.stepNumber} aria-hidden="true">
                        <span>{ordinal}</span>
                    </span>
                )}
                <span className={styles.rowText}>{children}</span>
                <span className={styles.rowCheck} aria-hidden="true">
                    <svg viewBox="0 0 18 18" className={styles.rowCheckMark}>
                        <path d="M4 9.5 7.5 13 14 5.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
                    </svg>
                </span>
                <Ripple />
            </button>
        </li>
    )
}

export function RecipeView({ recipe }: { recipe: Recipe }) {
    const initialServings = Number.parseInt(String(recipe.servings), 10)
    const hasNumericServings = Number.isFinite(initialServings) && initialServings > 0

    const [servings, setServings] = useState(hasNumericServings ? initialServings : 0)
    const [checkedIngredients, setCheckedIngredients] = useState<ReadonlySet<number>>(new Set())
    const [checkedSteps, setCheckedSteps] = useState<ReadonlySet<number>>(new Set())
    const [convertValue, setConvertValue] = useState('')
    const [conversions, setConversions] = useState<ConversionResult[] | null>(null)

    useWakeLock()

    const scale = hasNumericServings && servings > 0 ? Math.round((servings / initialServings) * 1000) / 1000 : 1
    const ingredients = useMemo(
        () => recipe.ingredients.map((ingredient) => displayIngredient(ingredient, scale)),
        [recipe.ingredients, scale],
    )

    const toggle = (set: ReadonlySet<number>, index: number): ReadonlySet<number> => {
        const next = new Set(set)
        if (next.has(index)) next.delete(index)
        else next.add(index)
        return next
    }

    const runConversion = () => {
        try {
            const qty = new Qty(convertValue)
            const results: ConversionResult[] = []
            for (const unit of Qty.getUnits()) {
                if (!qty.isCompatible(unit)) continue
                const converted = qty.to(unit).toPrec(0.0000001)
                let largestUnit: string = unit
                for (const alias of getAliases(unit)) {
                    if (alias.length > largestUnit.length) largestUnit = alias
                }
                results.push({ value: converted.scalar, unit: largestUnit })
            }
            setConversions(results)
        } catch {
            setConversions([])
        }
    }

    return (
        <div data-recipe-scope className={styles.scope}>
            <main className={styles.main}>
                <header className={styles.hero}>
                    <div className={styles.heroText}>
                        <h1 className={styles.title}>{unescapeHtml(recipe.title)}</h1>
                        {recipe.description && <p className={styles.description}>{unescapeHtml(recipe.description)}</p>}
                        <div className={styles.chips}>
                            {recipe.prepTime && <Chip icon="restaurant">Prep {recipe.prepTime}</Chip>}
                            {recipe.cookTime && <Chip icon="oven_gen">Cook {recipe.cookTime}</Chip>}
                            {recipe.totalTime && <Chip icon="schedule">{recipe.totalTime} total</Chip>}
                            {recipe.servings !== '' && (
                                <Chip icon="group">
                                    {hasNumericServings
                                        ? `Serves ${servings}${scale !== 1 ? ` · ${formatFraction(scale)}×` : ''}`
                                        : `Serves ${recipe.servings}`}
                                </Chip>
                            )}
                        </div>
                        <div className={styles.actions}>
                            <Button variant="tonal" icon="edit" href={`/recipe/${recipe.id}/edit`}>
                                Edit recipe
                            </Button>
                        </div>
                    </div>
                    <figure className={styles.heroImage}>
                        <RecipeImage
                            src={recipe.image}
                            alt={recipe.title}
                            priority
                            sizes="(min-width: 840px) 45vw, 100vw"
                        />
                    </figure>
                </header>

                <div className={styles.columns}>
                    <section className={styles.ingredients} aria-label="Ingredients">
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Ingredients</h2>
                            {hasNumericServings && (
                                <div className={styles.servings}>
                                    <IconButton
                                        icon="remove"
                                        label="Fewer servings"
                                        variant="tonal"
                                        disabled={servings <= 1}
                                        onClick={() => setServings((s) => Math.max(1, s - 1))}
                                    />
                                    <span className={styles.servingsValue}>
                                        {servings}
                                        <span className={styles.servingsLabel}>servings</span>
                                    </span>
                                    <IconButton
                                        icon="add"
                                        label="More servings"
                                        variant="tonal"
                                        disabled={servings >= 99}
                                        onClick={() => setServings((s) => Math.min(99, s + 1))}
                                    />
                                </div>
                            )}
                        </div>
                        {scale !== 1 && (
                            <button
                                type="button"
                                className={styles.scaleNote}
                                onClick={() => setServings(initialServings)}
                            >
                                <Icon name="scale" size={18} />
                                Scaled to {formatFraction(scale)}× (tap to reset)
                            </button>
                        )}
                        <ul className={styles.list}>
                            {ingredients.map((ingredient, index) => (
                                <ChecklistRow
                                    // biome-ignore lint/suspicious/noArrayIndexKey: static list, never reorders
                                    key={index}
                                    checked={checkedIngredients.has(index)}
                                    onToggle={() => setCheckedIngredients((set) => toggle(set, index))}
                                >
                                    {ingredient}
                                </ChecklistRow>
                            ))}
                        </ul>
                    </section>

                    <section className={styles.directions} aria-label="Directions">
                        <h2 className={styles.sectionTitle}>Directions</h2>
                        <ul className={styles.list}>
                            {recipe.instructions.map((instruction, index) => (
                                <ChecklistRow
                                    // biome-ignore lint/suspicious/noArrayIndexKey: static list, never reorders
                                    key={index}
                                    ordinal={index + 1}
                                    checked={checkedSteps.has(index)}
                                    onToggle={() => setCheckedSteps((set) => toggle(set, index))}
                                >
                                    {unescapeHtml(instruction)}
                                </ChecklistRow>
                            ))}
                        </ul>

                        {recipe.notes.length > 0 && (
                            <div className={styles.notes}>
                                <h2 className={styles.sectionTitle}>Notes</h2>
                                <p className={styles.notesBody}>{recipe.notes}</p>
                            </div>
                        )}
                    </section>
                </div>
            </main>

            <BottomSheet>
                <BottomSheetTrigger
                    render={
                        <Fab icon="straighten" color="tertiary" aria-label="Convert units" className={styles.fab} />
                    }
                />
                <BottomSheetContent>
                    <BottomSheetTitle>Convert units</BottomSheetTitle>
                    <form
                        className={styles.convertForm}
                        onSubmit={(event) => {
                            event.preventDefault()
                            runConversion()
                        }}
                    >
                        <TextField
                            label="Amount"
                            placeholder="e.g. 10 tablespoons"
                            value={convertValue}
                            onChange={(event) => setConvertValue(event.target.value)}
                            leadingIcon="straighten"
                            fullWidth
                            autoComplete="off"
                        />
                        <Button type="submit">Convert</Button>
                    </form>
                    {conversions !== null &&
                        (conversions.length === 0 ? (
                            <p className={styles.convertEmpty}>
                                That didn’t look like a quantity. Try something like “2 cups”.
                            </p>
                        ) : (
                            <ul className={styles.convertResults}>
                                {conversions.map((item) => (
                                    <li key={item.unit}>
                                        <span className={styles.convertValue}>{formatFraction(item.value)}</span>
                                        <span className={styles.convertUnit}>{item.unit}</span>
                                    </li>
                                ))}
                            </ul>
                        ))}
                </BottomSheetContent>
            </BottomSheet>
        </div>
    )
}
