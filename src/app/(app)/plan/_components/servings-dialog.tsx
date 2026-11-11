'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { NumberStepper } from '@/components/ui/number-stepper'
import type { PlanEntry, RecipeSummary } from '@/lib/domain/types'
import { LIMITS } from '@/lib/domain/types'
import { servingsNumber } from '@/lib/recipe/ingredients'
import styles from './plan.module.scss'

/** How many servings to cook; the grocery list scales to it. */
export function ServingsDialog({
    entry,
    recipe,
    onClose,
    onSave,
}: {
    entry: PlanEntry | null
    recipe: RecipeSummary | undefined
    onClose: () => void
    onSave: (entry: PlanEntry, servings: number | null) => void
}) {
    const [shown, setShown] = useState(entry)
    if (entry && entry !== shown) setShown(entry)
    return (
        <Dialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
            {shown && <Body key={shown.id} entry={shown} recipe={recipe} onSave={onSave} />}
        </Dialog>
    )
}

function Body({
    entry,
    recipe,
    onSave,
}: {
    entry: PlanEntry
    recipe: RecipeSummary | undefined
    onSave: (entry: PlanEntry, servings: number | null) => void
}) {
    const base = servingsNumber(recipe?.servings)
    const [value, setValue] = useState<number>(entry.servings ?? base ?? 2)
    // Matching the recipe's own count is stored as "the recipe's own", so a later edit to it follows.
    const save = () => onSave(entry, base !== null && value === base ? null : value)
    return (
        <DialogContent
            headline="Servings"
            className={styles.servingsDialog}
            actions={
                <>
                    <DialogClose render={<Button variant="text" />}>Cancel</DialogClose>
                    <Button variant="text" onClick={save}>
                        Save
                    </Button>
                </>
            }
        >
            <form
                className={styles.servingsBody}
                onSubmit={(event) => {
                    event.preventDefault()
                    save()
                }}
            >
                <NumberStepper
                    label="Servings"
                    labelHidden
                    size="l"
                    valueWidth={3}
                    value={value}
                    min={1}
                    max={LIMITS.planServings}
                    step={1}
                    onValueChange={(next) => {
                        if (next !== null && next >= 1) setValue(Math.round(next))
                    }}
                />
                {base !== null && value !== base && (
                    <Button type="button" variant="text" size="s" onClick={() => setValue(base)}>
                        {`Reset to ${base}`}
                    </Button>
                )}
            </form>
        </DialogContent>
    )
}
