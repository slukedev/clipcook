'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ConnectedButtonGroup, ConnectedButtonGroupItem } from '@/components/ui/button-group'
import { NumberStepper } from '@/components/ui/number-stepper'
import { ingredientSections } from '@/lib/cook/content'
import { checkedIngredients, recipeScale, useRecipeState } from '@/lib/cook/recipe-state'
import { servingsNumber } from '@/lib/recipe/ingredients'
import { GrocerySheet } from './grocery-sheet'
import { IngredientChecklist } from './ingredient-checklist'
import styles from './ingredients-panel.module.scss'

const QUICK = [
    { value: '0.5', label: '½×', name: 'Half' },
    { value: '1', label: '1×', name: 'Original' },
    { value: '2', label: '2×', name: 'Double' },
]

function round(n: number) {
    return Math.round(n * 100) / 100
}

/** Servings scaler, the ingredient checklist and "Add to list". */
export function IngredientsPanel({
    recipeId,
    ingredients,
    servings,
    icons,
}: {
    recipeId: string
    ingredients: string[]
    servings: string
    icons: { cart: ReactNode }
}) {
    const scale = useRecipeState(recipeScale, recipeId)
    const checked = useRecipeState(checkedIngredients, recipeId)
    const base = servingsNumber(servings)
    const sections = ingredientSections(ingredients, scale)
    const headingId = `ingredients-${recipeId}`
    const count = sections.reduce((n, s) => n + s.items.length, 0)
    const quick = QUICK.find((q) => Math.abs(Number(q.value) - scale) < 1e-6)?.value

    if (count === 0) return null

    return (
        <section className={styles.panel} aria-labelledby={headingId}>
            <div className={styles.head}>
                <h2 id={headingId} className={styles.title}>
                    Ingredients
                </h2>
                {checked.length > 0 && (
                    <Button variant="text" size="s" onClick={() => checkedIngredients.set(recipeId, [])}>
                        Clear
                    </Button>
                )}
                <GrocerySheet recipeId={recipeId} ingredients={ingredients} scale={scale} icon={icons.cart} />
            </div>
            <div className={styles.scaler}>
                {base !== null && (
                    <NumberStepper
                        label="Servings"
                        labelHidden
                        className={styles.stepper}
                        value={round(base * scale)}
                        min={1}
                        max={999}
                        step={1}
                        valueWidth={3}
                        onValueChange={(value) => {
                            if (value !== null && value > 0) recipeScale.set(recipeId, value / base)
                        }}
                    />
                )}
                {base !== null && (
                    <span className={styles.unit} aria-hidden>
                        {round(base * scale) === 1 ? 'serving' : 'servings'}
                    </span>
                )}
                <ConnectedButtonGroup
                    className={styles.quick}
                    label="Scale"
                    value={quick ? [quick] : []}
                    onValueChange={(value) => {
                        const next = value[0]
                        if (next) recipeScale.set(recipeId, Number(next))
                    }}
                >
                    {QUICK.map((q) => (
                        <ConnectedButtonGroupItem key={q.value} value={q.value} aria-label={q.name}>
                            {q.label}
                        </ConnectedButtonGroupItem>
                    ))}
                </ConnectedButtonGroup>
            </div>
            {scale !== 1 && (
                <p className={styles.printScale}>
                    {base !== null ? `For ${round(base * scale)} servings` : `Scaled ${round(scale)}×`}
                </p>
            )}
            <IngredientChecklist recipeId={recipeId} sections={sections} />
        </section>
    )
}
