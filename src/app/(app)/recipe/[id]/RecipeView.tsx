'use client'

import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { hexFromArgb, themeFromImage } from '@material/material-color-utilities'
import Fraction from 'fraction.js'
import Qty, { getAliases } from 'js-quantities'
import styles from '@/styles/Home.module.scss'
import { Button } from '@/components/button'
import { Checkbox } from '@/components/checkbox'
import { Icon } from '@/components/icon'
import { Input } from '@/components/input'
import { Main } from '@/components/main'
import { Modal } from '@/components/modal'
import { Ripple } from '@/components/ripple'
import type { Recipe } from '@/server/recipes'

function unescape(str: string): string {
    return str.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
}

function hexToRgb(hex: string): string | null {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!match) return null
    return `${parseInt(match[1]!, 16)}, ${parseInt(match[2]!, 16)}, ${parseInt(match[3]!, 16)}`
}

interface ConversionResult {
    value: number
    unit: string
}

export function RecipeView({ recipe }: { recipe: Recipe }) {
    const initialServings = Number.parseInt(String(recipe.servings), 10)
    const hasValidServings = Number.isFinite(initialServings) && initialServings > 0

    const [servings, setServings] = useState<number>(hasValidServings ? initialServings : 0)
    const [servingsScale, setServingsScale] = useState(1)
    const [servingsModal, setServingsModal] = useState(false)
    const [servingsDraft, setServingsDraft] = useState<string>(hasValidServings ? String(initialServings) : '')
    const [convertMenuOpen, setConvertMenuOpen] = useState(false)
    const [convertValue, setConvertValue] = useState('')
    const [conversions, setConversions] = useState<ConversionResult[] | null>(null)
    const [accent, setAccent] = useState<string | null>(null)

    const onServingsSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const parsed = Number.parseInt(servingsDraft, 10)
        setServingsModal(false)
        if (hasValidServings && parsed > 0 && parsed <= 100) {
            const newScale = Math.round((parsed / initialServings) * 1000) / 1000
            setServingsScale(newScale)
            setServings(parsed)
        }
    }

    const scaleIngredient = useCallback(
        (ingredient: string): string => {
            const amountRegex = /(\d+\/\d+|\d+\.\d+|\d+)/g
            const match = ingredient.match(amountRegex)
            if (!match) return ingredient
            const first = match[0]
            if (!first) return ingredient
            const scaled = Math.round(Number(first) * servingsScale * 1000) / 1000
            return ingredient.replace(amountRegex, String(scaled))
        },
        [servingsScale],
    )

    const formatIngredient = useCallback(
        (ingredient: string): string => {
            return unescape(scaleIngredient(ingredient)).replace(/-?\d+(?:\.\d+)?/g, (n) => {
                try {
                    return new Fraction(n).simplify(0.001).toFraction(true)
                } catch {
                    return n
                }
            })
        },
        [scaleIngredient],
    )

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

    useEffect(() => {
        let cancelled = false
        async function applyTheme() {
            if (typeof document === 'undefined') return
            const img = document.getElementById('recipeImage') as HTMLImageElement | null
            if (!img) return
            if (!img.complete) {
                await new Promise<void>((resolve) => {
                    img.addEventListener('load', () => resolve(), { once: true })
                    img.addEventListener('error', () => resolve(), { once: true })
                })
            }
            if (cancelled) return
            try {
                const theme = await themeFromImage(img)
                const darkScheme = theme.schemes.dark
                const entries = Object.entries(darkScheme as unknown as Record<string, number>)
                for (const [prop, argb] of entries) {
                    const cssName = prop.replace(/[^a-z]/g, (l) => `-${l.toLowerCase()}`)
                    const hex = hexFromArgb(argb)
                    const rgb = hexToRgb(hex)
                    document.body.style.setProperty(`--md-sys-color-${cssName}`, hex)
                    document.body.style.setProperty(`--md-sys-color-${cssName}-dark`, hex)
                    if (rgb) {
                        document.body.style.setProperty(`--md-sys-color-${cssName}-rgb`, rgb)
                        document.body.style.setProperty(`--md-sys-color-${cssName}-rgb-dark`, rgb)
                    }
                }
                setAccent(hexFromArgb(darkScheme.primary))
            } catch {
                // leave default theme
            }
        }
        void applyTheme()
        return () => {
            cancelled = true
        }
    }, [recipe.image])

    useEffect(() => {
        if (typeof navigator === 'undefined') return
        const wl = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release?: () => Promise<void> }> } }).wakeLock
        if (!wl) return
        let sentinel: { release?: () => Promise<void> } | null = null
        if (document.visibilityState !== 'visible') return
        wl.request('screen').then((s) => {
            sentinel = s
        }).catch(() => null)
        return () => {
            sentinel?.release?.().catch(() => null)
        }
    }, [])

    useEffect(() => {
        if (!accent) return
        const meta = document.querySelector('meta[name="theme-color"]')
        if (meta) meta.setAttribute('content', accent)
    }, [accent])

    const toggleChecklistItem = (e: ReactMouseEvent<HTMLDivElement>) => {
        const target = e.currentTarget
        const checkbox = target.querySelector("input[type='checkbox']") as HTMLInputElement | null
        if (!checkbox) return
        const text = target.classList.contains('instruction')
            ? (target.querySelector('.instruction') as HTMLElement | null)
            : (target.querySelector('span') as HTMLElement | null)
        checkbox.checked = !checkbox.checked
        if (text) {
            text.setAttribute(
                'style',
                checkbox.checked ? 'color: var(--primary); text-decoration: line-through;' : '',
            )
        }
    }

    const ingredientItems = useMemo(
        () => recipe.ingredients.map((i) => formatIngredient(i)),
        [recipe.ingredients, formatIngredient],
    )

    return (
        <>
            <Main pageName="recipe">
                <motion.div
                    key="recipe"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ ease: 'easeInOut', duration: 0.3 }}
                    exit={{ opacity: 0 }}
                >
                    <div className={styles.header}>
                        <div>
                            <h1>{recipe.title}</h1>
                            <p>{recipe.description}</p>
                            <div className={styles.externalInfo}>
                                <div className={styles.chip}>
                                    <Icon className={styles.icon} name="countertops" fill="0" iconsize="18" />
                                    <span>Prep Time: {recipe.prepTime}</span>
                                </div>
                                <div className={styles.chip}>
                                    <Icon className={styles.icon} name="cooking" fill="0" iconsize="18" />
                                    <span>Cook Time: {recipe.cookTime}</span>
                                </div>
                                <div className={styles.chip}>
                                    <Icon className={styles.icon} name="schedule" fill="0" iconsize="18" />
                                    <span>Total Time: {recipe.totalTime}</span>
                                </div>
                                <div className={styles.chip}>
                                    <Icon className={styles.icon} name="people" fill="0" iconsize="18" />
                                    <span>
                                        Servings: {servings}
                                        {servingsScale !== 1 ? ` (${servingsScale}x)` : ''}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.actions}>
                                <Button onClick={() => setServingsModal(true)}>Change Servings</Button>
                                <Link href={`/recipe/${recipe.id}/edit`} passHref>
                                    <Button>Edit Recipe</Button>
                                </Link>
                            </div>
                        </div>
                        <div style={{ borderRadius: '16px 0 0 16px' }} className={styles.image}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                style={{ borderRadius: '16px 0 0 16px' }}
                                id="recipeImage"
                                src={recipe.image}
                                alt={recipe.title}
                            />
                        </div>
                    </div>
                    <div className={styles.container}>
                        <h1 className={styles.title}>Ingredients</h1>
                        <div className={styles.ingredients}>
                            {ingredientItems.map((ingredient, index) => (
                                <Ripple
                                    key={index}
                                    feather="10px"
                                    style={{ width: '100%', borderRadius: 8 }}
                                >
                                    <div className={styles.ingredient} onClick={toggleChecklistItem}>
                                        <div className={styles.ingredientName}>
                                            <span>{ingredient}</span>
                                        </div>
                                        <div className={styles.ingredientCheckbox}>
                                            <Checkbox
                                                readOnly
                                                disabled
                                                style={{ pointerEvents: 'none' }}
                                                inputid={`ingredient-check-${index}`}
                                            />
                                        </div>
                                    </div>
                                </Ripple>
                            ))}
                        </div>
                    </div>
                    <div className={styles.container}>
                        <h1 className={styles.title}>Directions</h1>
                        <div className={styles.ingredients}>
                            {recipe.instructions.map((instruction, index) => (
                                <Ripple key={index} feather="10px" style={{ width: '100%', borderRadius: 8 }}>
                                    <div className={`${styles.ingredient} instruction`} onClick={toggleChecklistItem}>
                                        <div className={styles.directionNumber}>
                                            <span className={`${styles.number} number`}>{index + 1}</span>
                                            <svg width="120" height="120">
                                                <path d="M0.839206 40.5976C-4.14625 17.3914 16.4721 -3.42453 40.5835 0.47246L54.2854 2.68703C58.0691 3.29855 61.931 3.29855 65.7146 2.68703L79.4165 0.47246C103.528 -3.42453 124.146 17.3914 119.161 40.5976L116.514 52.9168C115.54 57.4515 115.54 62.1322 116.514 66.6669L119.251 79.4036C124.211 102.496 103.809 123.261 79.7848 119.573L65.436 117.37C61.8344 116.817 58.1656 116.817 54.564 117.37L40.2152 119.573C16.1906 123.261 -4.21146 102.496 0.749499 79.4036L3.48578 66.6669C4.45997 62.1322 4.45998 57.4515 3.48578 52.9168L0.839206 40.5976Z" />
                                            </svg>
                                        </div>
                                        <div className={styles.ingredientName}>
                                            <span className="instruction">{instruction}</span>
                                        </div>
                                        <div className={styles.ingredientCheckbox}>
                                            <Checkbox
                                                readOnly
                                                disabled
                                                style={{ pointerEvents: 'none' }}
                                                inputid={`instruction-check-${index}`}
                                            />
                                        </div>
                                    </div>
                                </Ripple>
                            ))}
                        </div>
                    </div>
                    {recipe.notes.length > 0 ? (
                        <div className={styles.container}>
                            <h1 className={styles.title}>Notes</h1>
                            <p>{recipe.notes}</p>
                        </div>
                    ) : null}
                </motion.div>
            </Main>

            <Modal
                opened={servingsModal}
                title="Change Servings"
                closefunction={() => setServingsModal(false)}
            >
                <form onSubmit={onServingsSubmit}>
                    <Input
                        type="number"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        label="Servings"
                        name="servings"
                        id="servings"
                        icon="people"
                        min={1}
                        max={100}
                        fullwidth
                        value={servingsDraft}
                        onChange={(e) => setServingsDraft(e.currentTarget.value)}
                        required
                    />
                    <div style={{ width: '100%', height: 24 }} />
                    <Button type="submit">Set Servings</Button>
                </form>
            </Modal>

            <div className={styles.fab}>
                <Ripple feather="5px" speedms={500}>
                    <button type="button" onClick={() => setConvertMenuOpen(true)}>
                        <Icon name="scale" iconsize="24" />
                    </button>
                </Ripple>
            </div>

            <AnimatePresence>
                {convertMenuOpen ? (
                    <motion.div
                        key="helpmenu"
                        initial={{ scale: 0.92, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ ease: 'easeInOut', duration: 0.1 }}
                        exit={{ opacity: 0 }}
                        className={`${styles.sheet} ${styles.options}`}
                    >
                        <div className={styles.top}>
                            <span>Conversion Menu</span>
                            <Button onClick={() => setConvertMenuOpen(false)}>Close</Button>
                        </div>
                        <div className={styles.initialValue}>
                            <Input
                                id="convertValue"
                                autoComplete="off"
                                label="Value"
                                name="convertValue"
                                type="text"
                                placeholder="Ex: 10 tablespoons"
                                icon="scale"
                                value={convertValue}
                                onChange={(e) => setConvertValue(e.currentTarget.value)}
                            />
                            <Button onClick={runConversion}>Convert!</Button>
                        </div>
                        <div>
                            {conversions === null ? null : conversions.length === 0 ? (
                                <h1>That unit was not found</h1>
                            ) : (
                                <ul style={{ width: 'auto' }}>
                                    {conversions.map((item, index) => (
                                        <li key={index}>
                                            {new Fraction(item.value).simplify(0.001).toFraction(true)} {item.unit}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </>
    )
}
