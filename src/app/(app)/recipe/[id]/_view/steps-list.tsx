'use client'

import type { MouseEvent, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Ripple } from '@/components/ui/ripple'
import { MorphShape } from '@/components/ui/shape'
import { stepSections, stepShape } from '@/lib/cook/content'
import { doneSteps, toggleIndex, useRecipeState } from '@/lib/cook/recipe-state'
import styles from './steps-list.module.scss'
import { StepText } from './timer-chip'

/** Numbered steps under their headings. Tap a step to mark it done; durations start timers. */
export function StepsList({
    recipeId,
    recipeTitle,
    instructions,
    icons,
}: {
    recipeId: string
    recipeTitle: string
    instructions: string[]
    icons: { timer: ReactNode; check: ReactNode }
}) {
    const done = useRecipeState(doneSteps, recipeId)
    const sections = stepSections(instructions)
    const headingId = `steps-${recipeId}`
    if (sections.length === 0) return null

    const toggleFromText = (event: MouseEvent<HTMLElement>, index: number) => {
        if ((event.target as HTMLElement).closest('button, a')) return
        if (window.getSelection()?.toString()) return
        toggleIndex(doneSteps, recipeId, index)
    }

    return (
        <section className={styles.steps} aria-labelledby={headingId}>
            <div className={styles.head}>
                <h2 id={headingId} className={styles.title}>
                    Steps
                </h2>
                {done.length > 0 && (
                    <Button variant="text" size="s" onClick={() => doneSteps.set(recipeId, [])}>
                        Clear
                    </Button>
                )}
            </div>
            {sections.map((section) => (
                <div key={section.steps[0]?.index ?? section.heading} className={styles.section}>
                    {section.heading && <h3 className={styles.heading}>{section.heading}</h3>}
                    <ol className={styles.list}>
                        {section.steps.map((step) => {
                            const isDone = done.includes(step.index)
                            const n = step.index + 1
                            return (
                                <li key={step.index} className={styles.step} data-done={isDone || undefined}>
                                    <button
                                        type="button"
                                        className={styles.number}
                                        aria-pressed={isDone}
                                        aria-label={`Step ${n} done`}
                                        onClick={() => toggleIndex(doneSteps, recipeId, step.index)}
                                    >
                                        <Ripple />
                                        <MorphShape
                                            className={styles.shape}
                                            shape={isDone ? 'circle' : stepShape(step.index)}
                                            spring="spatial-fast"
                                        />
                                        <span className={styles.digit} aria-hidden>
                                            {isDone ? icons.check : n}
                                        </span>
                                    </button>
                                    {/* biome-ignore lint/a11y/useKeyWithClickEvents: the number button beside it is the keyboard control */}
                                    <p className={styles.text} onClick={(e) => toggleFromText(e, step.index)}>
                                        <StepText
                                            text={step.text}
                                            ctx={{ recipeId, recipeTitle, step: n }}
                                            icon={icons.timer}
                                        />
                                    </p>
                                </li>
                            )
                        })}
                    </ol>
                </div>
            ))}
        </section>
    )
}
