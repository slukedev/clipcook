'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { List, ListItem } from '@/components/ui/list'
import { cx } from '@/components/ui/cx'
import type { IngredientSection } from '@/lib/cook/content'
import { checkedIngredients, toggleIndex, useRecipeState } from '@/lib/cook/recipe-state'
import styles from './ingredient-checklist.module.scss'

/**
 * Ingredient rows grouped under their headings. The whole 56dp row is the checkbox's label;
 * checks persist per recipe for the session and are shared with cook mode.
 */
export function IngredientChecklist({
    recipeId,
    sections,
    highlight,
    uses,
    className,
}: {
    recipeId: string
    sections: IngredientSection[]
    /** Ingredient indices to emphasize (the ones the current step uses). */
    highlight?: readonly number[]
    /** Ingredients the step being read uses; marked only where the list sits beside the steps. */
    uses?: readonly number[]
    className?: string
}) {
    const checked = useRecipeState(checkedIngredients, recipeId)
    return (
        <div className={cx(styles.checklist, className)}>
            {sections.map((section) => (
                <div key={section.items[0]?.index ?? section.heading} className={styles.section}>
                    {section.heading && <h3 className={styles.heading}>{section.heading}</h3>}
                    <List segmented label={section.heading ?? undefined}>
                        {section.items.map((item) => {
                            const isChecked = checked.includes(item.index)
                            const isHighlighted = highlight?.includes(item.index) ?? false
                            return (
                                <ListItem
                                    key={item.index}
                                    as="label"
                                    className={styles.row}
                                    selected={isHighlighted && !isChecked}
                                    itemProps={
                                        {
                                            'data-checked': isChecked ? '' : undefined,
                                            'data-uses': uses?.includes(item.index) && !isChecked ? '' : undefined,
                                        } as object
                                    }
                                    leading={
                                        <Checkbox
                                            aria-label={item.text}
                                            checked={isChecked}
                                            onCheckedChange={(value) =>
                                                toggleIndex(checkedIngredients, recipeId, item.index, value)
                                            }
                                        />
                                    }
                                    headline={
                                        <span className={styles.text}>
                                            {item.amount && <span className={styles.amount}>{item.amount}</span>}
                                            {item.amount && ' '}
                                            {item.rest}
                                        </span>
                                    }
                                />
                            )
                        })}
                    </List>
                </div>
            ))}
        </div>
    )
}
