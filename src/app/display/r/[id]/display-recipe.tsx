'use client'

import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import Link from 'next/link'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { RecipeImage } from '@/components/recipe-image'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { useFitText } from '@/lib/cook/use-fit-text'
import type { Recipe } from '@/lib/domain/types'
import { useSpring } from '@/lib/motion'
import { formatIngredient } from '@/lib/recipe/ingredients'
import { headingText, isHeadingLine } from '@/lib/recipe/text'
import { findTimers } from '@/lib/recipe/timers'
import { useDisplay } from '../../display-provider'
import styles from './display-recipe.module.scss'
import { TimerTray } from './timers'

export interface RecipeIcons {
    next: ReactNode
    prev: ReactNode
    start: ReactNode
    overview: ReactNode
    timer: ReactNode
    pause: ReactNode
    play: ReactNode
    close: ReactNode
    time: ReactNode
    servings: ReactNode
    check: ReactNode
    home: ReactNode
}

interface Step {
    text: string
    section: string | null
}

function toSteps(lines: string[]): Step[] {
    const steps: Step[] = []
    let section: string | null = null
    for (const line of lines) {
        if (isHeadingLine(line)) section = headingText(line)
        else if (line.trim()) steps.push({ text: line, section })
    }
    return steps
}

const SWIPE_PX = 60

export function DisplayRecipe({ recipe, icons }: { recipe: Recipe; icons: RecipeIcons }) {
    const { state, timers } = useDisplay()
    const steps = toSteps(recipe.instructions)
    const last = Math.max(0, steps.length - 1)
    const remote = state?.current?.recipeId === recipe.id ? state.current : null
    const scale = remote?.scale ?? 1

    const [mode, setMode] = useState<'overview' | 'step'>(remote?.step != null ? 'step' : 'overview')
    const [step, setStep] = useState(Math.min(remote?.step ?? 0, last))
    const [direction, setDirection] = useState(1)
    const [checked, setChecked] = useState<ReadonlySet<number>>(() => new Set())
    const viewportRef = useRef<HTMLDivElement>(null)
    const stepTextRef = useRef<HTMLParagraphElement>(null)
    useFitText(viewportRef, stepTextRef, `${mode}:${step}`, 22)

    // The phone drives: each new version it sends replaces whatever was tapped here.
    const [seenVersion, setSeenVersion] = useState<number | null>(null)
    if (state && state.version !== seenVersion) {
        setSeenVersion(state.version)
        if (remote) {
            if (remote.step === null) setMode('overview')
            else {
                const next = Math.min(Math.max(0, remote.step), last)
                setDirection(next >= step ? 1 : -1)
                setStep(next)
                setMode('step')
            }
        }
    }

    function goTo(index: number) {
        const next = Math.min(Math.max(0, index), last)
        if (next === step && mode === 'step') return
        setDirection(next >= step ? 1 : -1)
        setStep(next)
        setMode('step')
    }

    function toggleIngredient(index: number) {
        setChecked((current) => {
            const next = new Set(current)
            if (next.has(index)) next.delete(index)
            else next.add(index)
            return next
        })
    }

    // Arrow keys for TV remotes and keyboards, unless a control has focus and wants them.
    useEffect(() => {
        if (mode !== 'step') return
        const onKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement
            if (target.closest('input, textarea, [role="menu"], [role="dialog"]')) return
            if (event.key === 'ArrowRight') goTo(step + 1)
            else if (event.key === 'ArrowLeft') goTo(step - 1)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    })

    const spatial = useSpring('spatial-default')
    const effects = useSpring('effects-default')

    const current = steps[step]
    const meta = [
        recipe.totalTime && { icon: icons.time, label: recipe.totalTime },
        recipe.servings && {
            icon: icons.servings,
            label: scale === 1 ? recipe.servings : `${recipe.servings} × ${scale}`,
        },
    ].filter(Boolean) as { icon: ReactNode; label: string }[]

    const ingredients = (
        <section className={styles.ingredients} aria-labelledby="display-ingredients">
            <h2 id="display-ingredients" className={styles.paneTitle}>
                Ingredients
            </h2>
            <ul className={styles.ingredientList}>
                {recipe.ingredients.map((line, index) =>
                    isHeadingLine(line) ? (
                        // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional and can repeat
                        <li key={index} className={styles.ingredientHeading}>
                            {headingText(line)}
                        </li>
                    ) : (
                        // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional and can repeat
                        <li key={index}>
                            <label className={styles.ingredient}>
                                <input
                                    type="checkbox"
                                    className={styles.ingredientInput}
                                    checked={checked.has(index)}
                                    onChange={() => toggleIngredient(index)}
                                />
                                <span className={styles.ingredientBox} aria-hidden>
                                    {icons.check}
                                </span>
                                <span className={styles.ingredientText}>{formatIngredient(line, scale)}</span>
                            </label>
                        </li>
                    ),
                )}
            </ul>
        </section>
    )

    return (
        <MotionConfig reducedMotion="user">
            <main className={styles.root} data-display-recipe="" data-mode={mode}>
                <aside className={styles.side}>
                    {mode === 'overview' ? (
                        <>
                            {/* The way back to the home screen, where the household picks what to cook. */}
                            <div className={recipe.image ? styles.photo : styles.homeRow}>
                                {recipe.image && <RecipeImage src={recipe.image} alt="" sizes="40vw" priority />}
                                <IconButton
                                    label="Home"
                                    icon={icons.home}
                                    variant="tonal"
                                    size="m"
                                    className={styles.home}
                                    render={<Link href="/display" />}
                                    nativeButton={false}
                                />
                            </div>
                            <h1 className={styles.title}>{recipe.title}</h1>
                            {meta.length > 0 && (
                                <ul className={styles.meta}>
                                    {meta.map((m) => (
                                        <li key={m.label}>
                                            {m.icon}
                                            {m.label}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {steps.length > 0 && (
                                <Button size="l" icon={icons.start} className={styles.start} onClick={() => goTo(0)}>
                                    Start
                                </Button>
                            )}
                        </>
                    ) : (
                        <div className={styles.compactHeader}>
                            {recipe.thumbnail && (
                                <span className={styles.thumb}>
                                    <RecipeImage src={recipe.thumbnail} alt="" sizes="72px" />
                                </span>
                            )}
                            <h1 className={styles.compactTitle}>{recipe.title}</h1>
                        </div>
                    )}
                    {ingredients}
                </aside>

                {mode === 'overview' ? (
                    <section className={styles.stepsPane} aria-labelledby="display-steps">
                        <h2 id="display-steps" className={styles.paneTitle}>
                            Steps
                        </h2>
                        <ol className={styles.stepList}>
                            {steps.map((s, index) => (
                                // biome-ignore lint/suspicious/noArrayIndexKey: steps are positional
                                <li key={index}>
                                    {s.section && (index === 0 || steps[index - 1]?.section !== s.section) && (
                                        <p className={styles.stepSection}>{s.section}</p>
                                    )}
                                    <button type="button" className={styles.stepRow} onClick={() => goTo(index)}>
                                        <span className={styles.stepNumber} aria-hidden>
                                            {index + 1}
                                        </span>
                                        <span>{s.text}</span>
                                    </button>
                                </li>
                            ))}
                        </ol>
                    </section>
                ) : (
                    <section
                        className={styles.stage}
                        aria-roledescription="step"
                        aria-label={`Step ${step + 1} of ${steps.length}`}
                        onPointerDown={(event) => {
                            const startX = event.clientX
                            const startY = event.clientY
                            const el = event.currentTarget
                            const up = (e: PointerEvent) => {
                                el.removeEventListener('pointerup', up)
                                const dx = e.clientX - startX
                                if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - startY) * 1.5) {
                                    goTo(step + (dx < 0 ? 1 : -1))
                                }
                            }
                            el.addEventListener('pointerup', up)
                        }}
                    >
                        <div className={styles.stageTop}>
                            <p className={styles.counter}>
                                Step {step + 1} <span>of {steps.length}</span>
                            </p>
                            <ol className={styles.progress} aria-hidden>
                                {steps.map((_, index) => (
                                    <li
                                        // biome-ignore lint/suspicious/noArrayIndexKey: one segment per step
                                        key={index}
                                        data-done={index < step || undefined}
                                        data-current={index === step || undefined}
                                    />
                                ))}
                            </ol>
                        </div>

                        {timers && <TimerTray timers={timers} icons={icons} />}

                        <div ref={viewportRef} className={styles.stepViewport} aria-live="polite">
                            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                                <motion.div
                                    key={step}
                                    className={styles.stepBody}
                                    custom={direction}
                                    variants={{
                                        enter: (d: number) => ({ transform: `translateX(${d * 56}px)`, opacity: 0 }),
                                        center: { transform: 'translateX(0px)', opacity: 1 },
                                        exit: (d: number) => ({ transform: `translateX(${d * -56}px)`, opacity: 0 }),
                                    }}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ transform: spatial, opacity: effects }}
                                >
                                    {current?.section && <p className={styles.stepSection}>{current.section}</p>}
                                    <p ref={stepTextRef} className={styles.stepText}>
                                        {current && (
                                            <StepText
                                                text={current.text}
                                                timerIcon={icons.timer}
                                                onTimer={(label, seconds) =>
                                                    timers?.start(
                                                        `${recipe.id}:${step}:${label}`,
                                                        label,
                                                        `step ${step + 1}, ${recipe.title}`,
                                                        seconds,
                                                    )
                                                }
                                            />
                                        )}
                                    </p>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        <div className={styles.controls}>
                            <Button
                                variant="text"
                                size="l"
                                className={styles.overviewButton}
                                icon={icons.overview}
                                onClick={() => setMode('overview')}
                            >
                                Overview
                            </Button>
                            <div className={styles.navButtons}>
                                <Button
                                    variant="tonal"
                                    size="l"
                                    icon={icons.prev}
                                    disabled={step === 0}
                                    onClick={() => goTo(step - 1)}
                                >
                                    Back
                                </Button>
                                {step < last ? (
                                    <Button size="l" trailingIcon={icons.next} onClick={() => goTo(step + 1)}>
                                        Next
                                    </Button>
                                ) : (
                                    <Button size="l" icon={icons.check} onClick={() => setMode('overview')}>
                                        Done
                                    </Button>
                                )}
                            </div>
                        </div>
                    </section>
                )}
            </main>
        </MotionConfig>
    )
}

/** Punctuation that belongs to the words before it and must not wrap away from a chip. */
const TRAILING = /^[.,;:!?)\]]+/

/** Step text with every duration turned into a tap-to-start timer. */
function StepText({
    text,
    timerIcon,
    onTimer,
}: {
    text: string
    timerIcon: ReactNode
    onTimer: (label: string, seconds: number) => void
}) {
    const found = findTimers(text)
    if (found.length === 0) return <>{text}</>
    const parts: ReactNode[] = []
    let cursor = 0
    for (const timer of found) {
        if (timer.start > cursor) parts.push(text.slice(cursor, timer.start))
        const tail = TRAILING.exec(text.slice(timer.end))?.[0] ?? ''
        parts.push(
            <span key={timer.start} className={styles.timerRun}>
                <button
                    type="button"
                    className={styles.inlineTimer}
                    onClick={(event) => {
                        event.stopPropagation()
                        onTimer(timer.label, timer.seconds)
                    }}
                    aria-label={`Start a ${timer.label} timer`}
                >
                    {timerIcon}
                    {text.slice(timer.start, timer.end)}
                </button>
                {tail}
            </span>,
        )
        cursor = timer.end + tail.length
    }
    if (cursor < text.length) parts.push(text.slice(cursor))
    return <>{parts}</>
}
