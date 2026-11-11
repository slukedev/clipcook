'use client'

import { useRouter } from 'next/navigation'
import {
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
    ViewTransition,
} from 'react'
import { markCooked } from '@/actions/recipes'
import { sendToDisplay } from '@/actions/displays'
import { rememberDisplay } from '@/app/(app)/recipe/[id]/_view/send-to-display'
import { DisplayLabel, sentMessage, sortByPresence } from '@/components/kitchen/display-presence'
import { IngredientChecklist } from '@/app/(app)/recipe/[id]/_view/ingredient-checklist'
import { TimerChip } from '@/app/(app)/recipe/[id]/_view/timer-chip'
import { TimerTray } from '@/app/(app)/recipe/[id]/_view/timer-tray'
import type { DisplayOption } from '@/app/(app)/recipe/[id]/_view/types'
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { cx } from '@/components/ui/cx'
import { IconButton } from '@/components/ui/icon-button'
import { Menu, MenuContent, MenuGroup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from '@/components/ui/menu'
import { MorphShape, type ShapeName } from '@/components/ui/shape'
import { useSnackbar } from '@/components/ui/snackbar'
import { Tooltip } from '@/components/ui/tooltip'
import { vtName } from '@/components/ui/view-transition'
import { flatSteps, ingredientSections, mentionedIngredients, stepShape } from '@/lib/cook/content'
import { cookStep, doneSteps, recipeScale, useRecipeState } from '@/lib/cook/recipe-state'
import { timerActions, useTimers } from '@/lib/cook/timers'
import { useReducedMotion } from '@/lib/motion'
import { findTimers } from '@/lib/recipe/timers'
import styles from './cook-mode.module.scss'
import { useFitText } from '@/lib/cook/use-fit-text'
import { speak, useHandsFree, useSpeechSupported, type VoiceCommand } from './use-hands-free'
import { useWakeLock } from './use-wake-lock'

type IconKey =
    | 'close'
    | 'list'
    | 'mic'
    | 'micOff'
    | 'cast'
    | 'castConnected'
    | 'tv'
    | 'timer'
    | 'play'
    | 'pause'
    | 'back'
    | 'next'
    | 'check'
    | 'volume'
    | 'restart'

type Enter = 'next' | 'prev' | 'none'

/** Matches the stylesheet's expanded layout, where ingredients sit beside the step. */
const WIDE = '(width >= 840px)'
const isWide = () => window.matchMedia(WIDE).matches

function useCanSpeak(): boolean {
    return useSyncExternalStore(
        () => () => undefined,
        () => 'speechSynthesis' in window,
        () => false,
    )
}

/** iOS-style resistance past the first and last step. */
function rubberBand(dx: number, width: number): number {
    const sign = Math.sign(dx)
    return sign * (1 - 1 / ((Math.abs(dx) * 0.55) / width + 1)) * width * 0.5
}

const CELEBRATE: ShapeName[] = ['soft-burst', 'cookie12', 'sunny', 'flower', 'circle']

/** Text with its durations set in emphasis, so the eye finds them from across the kitchen. */
function Emphasized({ text }: { text: string }) {
    const found = findTimers(text)
    if (found.length === 0) return <>{text}</>
    const parts: ReactNode[] = []
    let cursor = 0
    for (const t of found) {
        if (t.start > cursor) parts.push(text.slice(cursor, t.start))
        parts.push(
            <strong key={t.start} className={styles.duration}>
                {text.slice(t.start, t.end)}
            </strong>,
        )
        cursor = t.end
    }
    parts.push(text.slice(cursor))
    return <>{parts}</>
}

export function CookMode({
    recipe,
    displays,
    icons,
}: {
    recipe: { id: string; title: string; servings: string; ingredients: string[]; instructions: string[] }
    displays: DisplayOption[]
    icons: Record<IconKey, ReactNode>
}) {
    const router = useRouter()
    const snackbar = useSnackbar()
    const reduce = useReducedMotion()
    const speechSupported = useSpeechSupported()
    const canSpeak = useCanSpeak()
    useWakeLock()

    const steps = flatSteps(recipe.instructions)
    const total = steps.length
    const stored = useRecipeState(cookStep, recipe.id)
    const index = Math.min(stored, Math.max(0, total - 1))
    const step = steps[index]
    const last = index === total - 1
    const scale = useRecipeState(recipeScale, recipe.id)
    const sections = ingredientSections(recipe.ingredients, scale)
    const mentioned = step ? mentionedIngredients(step.text, recipe.ingredients) : []
    const mentionedItems = sections.flatMap((s) => s.items).filter((item) => mentioned.includes(item.index))
    const stepTimers = step ? findTimers(step.text) : []
    // A started timer leaves the step's chips and docks in the tray beside them.
    const timers = useTimers()
    const idleTimers = stepTimers.filter(
        (t) => !timers.some((x) => x.recipeId === recipe.id && x.step === index + 1 && x.label === t.label),
    )
    const hasIngredients = sections.some((s) => s.items.length > 0)

    const [enter, setEnter] = useState<Enter>('none')
    const [sheetOpen, setSheetOpen] = useState(false)
    const [listening, setListening] = useState(false)
    const [syncTo, setSyncTo] = useState<string | null>(null)
    const [celebrate, setCelebrate] = useState<number | null>(null)
    const [menuNow, setMenuNow] = useState(0)

    const stageRef = useRef<HTMLElement>(null)
    const cardRef = useRef<HTMLDivElement>(null)
    const dockRef = useRef<HTMLDivElement>(null)
    /** A timer started from the keyboard: focus follows it into the tray. */
    const handoff = useRef<string | null>(null)
    useFitText(stageRef, cardRef, `${index}:${scale}:${mentioned.join()}`)
    const drag = useRef<{
        id: number
        x: number
        y: number
        t: number
        dx: number
        active: boolean
        samples: Array<[number, number]>
    } | null>(null)

    const go = (to: number, how: Enter) => {
        if (to < 0 || to >= total || celebrate !== null) return
        setEnter(reduce && how !== 'none' ? 'none' : how)
        cookStep.set(recipe.id, to)
    }

    const exit = () => {
        const nav = (window as unknown as { navigation?: { canGoBack?: boolean } }).navigation
        if (nav?.canGoBack) router.back()
        else router.replace(`/recipe/${recipe.id}`, { transitionTypes: ['cook'] })
    }

    const finish = () => {
        if (celebrate !== null) return
        setCelebrate(0)
        void markCooked(recipe.id).then((result) => {
            if (!result.ok) snackbar({ message: "Couldn't save that you cooked this.", urgent: true })
        })
    }

    const next = (how: Enter = 'next') => (last ? finish() : go(index + 1, how))
    const prev = (how: Enter = 'prev') => go(index - 1, how)

    // The celebration: a quick run of shapes that settles into a check, then back to the recipe.
    useEffect(() => {
        if (celebrate === null) return
        if (celebrate >= CELEBRATE.length - 1) {
            const done = window.setTimeout(
                () => {
                    // Next time starts from the top.
                    cookStep.forget(recipe.id)
                    doneSteps.forget(recipe.id)
                    exit()
                },
                reduce ? 500 : 420,
            )
            return () => window.clearTimeout(done)
        }
        const tick = window.setTimeout(() => setCelebrate((c) => (c === null ? c : c + 1)), reduce ? 120 : 170)
        return () => window.clearTimeout(tick)
    })

    // Keyboard: arrows and space page, Escape leaves. No animation for key presses.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
            const target = event.target as HTMLElement
            if (target.closest('input, textarea, [contenteditable], [role="dialog"], [role="menu"]')) return
            if (event.key === 'ArrowRight' || event.key === 'PageDown') {
                event.preventDefault()
                next('none')
            } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
                event.preventDefault()
                prev('none')
            } else if (event.key === ' ' && !target.closest('button, a, [role="checkbox"]')) {
                event.preventDefault()
                if (event.shiftKey) prev('none')
                else next('none')
            } else if (event.key === 'Escape') {
                exit()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    })

    useEffect(() => {
        stageRef.current?.focus({ preventScroll: true })
    }, [])

    // Growing into the two-pane layout shows the ingredients beside the step; drop the sheet.
    useEffect(() => {
        const query = window.matchMedia(WIDE)
        const onChange = () => query.matches && setSheetOpen(false)
        query.addEventListener('change', onChange)
        return () => query.removeEventListener('change', onChange)
    }, [])

    useEffect(() => {
        const key = handoff.current
        if (!key || !timers.some((t) => `${t.recipeId}:${t.step}:${t.label}` === key)) return
        handoff.current = null
        dockRef.current?.querySelector<HTMLElement>(`[data-timer="${CSS.escape(key)}"] button`)?.focus()
    }, [timers])

    // Mirror every step on the chosen display, debounced so fast paging sends once.
    useEffect(() => {
        if (!syncTo) return
        const timer = window.setTimeout(() => {
            void sendToDisplay(syncTo, { recipeId: recipe.id, step: index, scale }).then((result) => {
                if (!result.ok) {
                    setSyncTo(null)
                    snackbar({ message: result.error, urgent: true })
                }
            })
        }, 150)
        return () => window.clearTimeout(timer)
    }, [syncTo, index, scale, recipe.id, snackbar])

    const readStep = () => {
        if (!step) return
        const text = step.section ? `${step.section}. ${step.text}` : step.text
        if (listening) void handsFree.say(text)
        else void speak(text)
    }

    const onVoice = (command: VoiceCommand) => {
        if (command === 'next') next()
        else if (command === 'back') prev()
        else if (command === 'repeat') readStep()
        else if (command === 'stop') setListening(false)
        else if (command === 'ingredients') {
            if (isWide()) document.getElementById(`cook-ingredients-${recipe.id}`)?.focus()
            else setSheetOpen(true)
        } else if (command === 'timer') {
            const first = stepTimers[0]
            if (first && step)
                timerActions.start({
                    recipeId: recipe.id,
                    recipeTitle: recipe.title,
                    step: index + 1,
                    label: first.label,
                    seconds: first.seconds,
                })
        }
    }

    const handsFree = useHandsFree(listening, onVoice, (reason) => {
        setListening(false)
        snackbar({
            message: reason === 'blocked' ? 'Microphone is blocked for this site.' : "Couldn't keep listening.",
            urgent: true,
        })
    })

    // Swipe with the finger, page on distance or velocity, resist past the ends.
    const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
        if (event.pointerType === 'mouse' || !event.isPrimary || celebrate !== null) return
        if ((event.target as HTMLElement).closest('button, a, [role="checkbox"]')) return
        drag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            t: event.timeStamp,
            dx: 0,
            active: false,
            samples: [[event.timeStamp, event.clientX]],
        }
    }

    const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
        const d = drag.current
        const card = cardRef.current
        if (!d || event.pointerId !== d.id || !card) return
        const dx = event.clientX - d.x
        const dy = event.clientY - d.y
        if (!d.active) {
            if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
                drag.current = null
                return
            }
            if (Math.abs(dx) < 10) return
            d.active = true
            card.style.willChange = 'transform'
            try {
                event.currentTarget.setPointerCapture(event.pointerId)
            } catch {
                // The pointer already ended.
            }
        }
        d.dx = dx
        d.samples.push([event.timeStamp, event.clientX])
        if (d.samples.length > 6) d.samples.shift()
        const width = event.currentTarget.clientWidth
        const blocked = (dx > 0 && index === 0) || (dx < 0 && last)
        card.style.transform = `translateX(${blocked ? rubberBand(dx, width) : dx}px)`
    }

    const settle = (card: HTMLElement, from: number) => {
        card.style.transform = ''
        card.style.willChange = ''
        if (reduce || from === 0) return
        card.animate([{ transform: `translateX(${from}px)` }, { transform: 'translateX(0)' }], {
            duration: 435,
            easing:
                getComputedStyle(card).getPropertyValue('--md-sys-motion-spring-spatial-default').trim() || 'ease-out',
        })
    }

    const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
        const d = drag.current
        drag.current = null
        const card = cardRef.current
        if (!d || event.pointerId !== d.id || !card) return
        const width = event.currentTarget.clientWidth
        if (!d.active) {
            // A tap on the outer thirds pages, like a book.
            if (event.timeStamp - d.t < 350) {
                const rect = event.currentTarget.getBoundingClientRect()
                const x = (event.clientX - rect.left) / rect.width
                if (x < 1 / 3) prev()
                else if (x > 2 / 3) next()
            }
            return
        }
        const [t0, x0] = d.samples[0] ?? [d.t, d.x]
        const velocity = (event.clientX - x0) / Math.max(1, event.timeStamp - t0)
        const dir = Math.abs(velocity) > 0.4 ? Math.sign(velocity) : Math.abs(d.dx) > width * 0.22 ? Math.sign(d.dx) : 0
        const blocked = dir === 0 || (dir > 0 && index === 0) || (dir < 0 && last)
        const current = (d.dx > 0 && index === 0) || (d.dx < 0 && last) ? rubberBand(d.dx, width) : d.dx
        if (blocked) {
            settle(card, current)
            return
        }
        const out = card.animate(
            [
                { transform: `translateX(${current}px)`, opacity: 1 },
                { transform: `translateX(${dir * width * 0.4}px)`, opacity: 0 },
            ],
            { duration: 160, easing: 'cubic-bezier(0.3, 0, 0.8, 0.15)', fill: 'forwards' },
        )
        out.onfinish = () => {
            card.style.transform = ''
            card.style.willChange = ''
            if (dir < 0) next()
            else prev()
            out.cancel()
        }
    }

    const onPointerCancel = () => {
        const d = drag.current
        drag.current = null
        if (d?.active && cardRef.current) settle(cardRef.current, 0)
    }

    const follow = (display: DisplayOption | null) => {
        setSyncTo(display?.id ?? null)
        if (!display) return
        rememberDisplay(display.id)
        snackbar(sentMessage(display, Date.now()))
    }

    const displayControl = () => {
        if (displays.length === 0) return null
        const icon = syncTo ? icons.castConnected : icons.cast
        if (displays.length === 1) {
            const only = displays[0] as DisplayOption
            return (
                <Tooltip content={syncTo ? `Stop showing on ${only.name}` : `Show on ${only.name}`}>
                    <IconButton
                        size="m"
                        width="narrow"
                        label={`Show on ${only.name}`}
                        icon={icons.cast}
                        selectedIcon={icons.castConnected}
                        selected={syncTo !== null}
                        onSelectedChange={(on) => follow(on ? only : null)}
                    />
                </Tooltip>
            )
        }
        return (
            <Menu onOpenChange={(open) => open && setMenuNow(Date.now())}>
                <MenuTrigger
                    render={
                        <IconButton
                            size="m"
                            width="narrow"
                            label="Show on display"
                            icon={icon}
                            aria-pressed={syncTo !== null}
                        />
                    }
                />
                <MenuContent align="end">
                    <MenuGroup label="Follow along on">
                        <MenuRadioGroup
                            value={syncTo ?? 'off'}
                            onValueChange={(value: string) =>
                                follow(value === 'off' ? null : (displays.find((d) => d.id === value) ?? null))
                            }
                        >
                            <MenuRadioItem value="off">Off</MenuRadioItem>
                            {sortByPresence(displays).map((d) => (
                                <MenuRadioItem key={d.id} value={d.id} icon={icons.tv}>
                                    <DisplayLabel display={d} now={menuNow} />
                                </MenuRadioItem>
                            ))}
                        </MenuRadioGroup>
                    </MenuGroup>
                </MenuContent>
            </Menu>
        )
    }

    const checklist = (
        <IngredientChecklist
            recipeId={recipe.id}
            sections={sections}
            highlight={mentioned}
            className={styles.checklist}
        />
    )

    return (
        <ViewTransition name={vtName('cook', recipe.id)} share="cc-cook" default="none">
            <div className={styles.root} data-recipe={recipe.id}>
                <header className={styles.bar}>
                    <IconButton size="m" width="narrow" label="Close cook mode" icon={icons.close} onClick={exit} />
                    <div className={styles.heading}>
                        <h1 className={styles.recipeTitle}>{recipe.title}</h1>
                        {total > 0 && (
                            <p className={styles.counter}>
                                Step {index + 1} of {total}
                            </p>
                        )}
                    </div>
                    <div className={styles.actions}>
                        {canSpeak && step && (
                            <Tooltip content="Read aloud">
                                <IconButton
                                    size="m"
                                    width="narrow"
                                    label="Read step aloud"
                                    icon={icons.volume}
                                    onClick={readStep}
                                />
                            </Tooltip>
                        )}
                        {speechSupported && (
                            <Tooltip content={listening ? 'Stop listening' : 'Hands-free'}>
                                <span className={styles.micWrap} data-listening={listening || undefined}>
                                    <IconButton
                                        size="m"
                                        width="narrow"
                                        label="Hands-free"
                                        icon={icons.micOff}
                                        selectedIcon={icons.mic}
                                        selected={listening}
                                        onSelectedChange={setListening}
                                    />
                                </span>
                            </Tooltip>
                        )}
                        {displayControl()}
                        {hasIngredients && (
                            <Tooltip content="Ingredients">
                                <IconButton
                                    size="m"
                                    width="narrow"
                                    className={styles.compactOnly}
                                    label="Ingredients"
                                    icon={icons.list}
                                    onClick={() => setSheetOpen(true)}
                                />
                            </Tooltip>
                        )}
                    </div>
                </header>

                {total > 0 && (
                    <div
                        className={styles.progress}
                        role="progressbar"
                        aria-label="Progress"
                        aria-valuemin={1}
                        aria-valuemax={total}
                        aria-valuenow={index + 1}
                        aria-valuetext={`Step ${index + 1} of ${total}`}
                    >
                        {steps.map((s) => (
                            <span
                                key={s.index}
                                className={styles.segment}
                                data-state={s.index < index ? 'done' : s.index === index ? 'current' : undefined}
                            />
                        ))}
                    </div>
                )}

                <main
                    ref={stageRef}
                    className={styles.stage}
                    tabIndex={-1}
                    aria-label="Current step"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                    onLostPointerCapture={onPointerCancel}
                >
                    {step ? (
                        <div className={styles.content}>
                            <div className={styles.number} aria-hidden>
                                <MorphShape
                                    className={styles.numberShape}
                                    shape={stepShape(index)}
                                    spring="spatial-default"
                                />
                                <span className={styles.numberText}>{index + 1}</span>
                            </div>
                            <div key={index} ref={cardRef} className={styles.card} data-enter={enter}>
                                {step.section && <p className={styles.section}>{step.section}</p>}
                                <p className={styles.stepText}>
                                    <Emphasized text={step.text} />
                                </p>
                                {mentionedItems.length > 0 && (
                                    <ul className={cx(styles.uses, styles.compactOnly)} aria-label="Uses">
                                        {mentionedItems.map((item) => (
                                            <li key={item.index} className={styles.use}>
                                                {item.amount && (
                                                    <span className={styles.useAmount}>{item.amount}</span>
                                                )}{' '}
                                                {item.rest}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className={styles.stepText}>This recipe has no steps yet.</p>
                    )}
                </main>

                {hasIngredients && (
                    <aside
                        id={`cook-ingredients-${recipe.id}`}
                        className={styles.side}
                        aria-label="Ingredients"
                        tabIndex={-1}
                    >
                        <h2 className={styles.sideTitle}>Ingredients</h2>
                        {checklist}
                    </aside>
                )}

                <div ref={dockRef} className={styles.dock}>
                    {idleTimers.length > 0 && (
                        <div
                            className={styles.stepTimers}
                            onClickCapture={(event) => {
                                // detail 0: Enter or Space, so focus should follow the timer it started.
                                const label = (event.target as HTMLElement).closest<HTMLElement>('[data-label]')?.dataset
                                    .label
                                if (event.detail === 0 && label) handoff.current = `${recipe.id}:${index + 1}:${label}`
                            }}
                        >
                            {idleTimers.map((t) => (
                                <span key={t.start} data-label={t.label} className={styles.stepTimer}>
                                    <TimerChip
                                        timer={t}
                                        size="large"
                                        icon={icons.timer}
                                        ctx={{
                                            recipeId: recipe.id,
                                            recipeTitle: recipe.title,
                                            step: index + 1,
                                        }}
                                    />
                                </span>
                            ))}
                        </div>
                    )}
                    <TimerTray
                        recipeId={recipe.id}
                        variant="cook"
                        className={styles.tray}
                        icons={{ timer: icons.timer, play: icons.play, pause: icons.pause }}
                    />
                </div>

                <footer className={styles.controls}>
                    <Button
                        className={styles.prev}
                        variant="tonal"
                        size="m"
                        icon={icons.back}
                        disabled={index === 0}
                        onClick={() => prev()}
                    >
                        Back
                    </Button>
                    <Button
                        className={styles.next}
                        size="m"
                        trailingIcon={last ? icons.check : icons.next}
                        disabled={total === 0}
                        onClick={() => next()}
                    >
                        {last ? 'Done' : 'Next'}
                    </Button>
                </footer>

                {hasIngredients && (
                    <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen}>
                        <BottomSheetContent title="Ingredients">{checklist}</BottomSheetContent>
                    </BottomSheet>
                )}

                <p className={styles.live} aria-live="polite">
                    {celebrate !== null
                        ? 'Marked as cooked.'
                        : step
                          ? `Step ${index + 1} of ${total}. ${step.text}`
                          : ''}
                </p>

                {celebrate !== null && (
                    <div className={styles.celebrate} aria-hidden>
                        <div className={styles.celebrateShape}>
                            <MorphShape
                                className={styles.celebrateMorph}
                                shape={CELEBRATE[celebrate] ?? 'circle'}
                                spring="spatial-fast"
                            />
                            <span
                                className={styles.celebrateCheck}
                                data-show={celebrate >= CELEBRATE.length - 1 || undefined}
                            >
                                {icons.check}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </ViewTransition>
    )
}
