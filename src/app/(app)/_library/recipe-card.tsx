'use client'

import { useRouter } from 'next/navigation'
import { type MouseEvent, type PointerEvent, type ReactNode, useRef } from 'react'
import { IconButton } from '@/components/ui/icon-button'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { morphTarget, SharedElement, TransitionLink, vtName } from '@/components/ui/view-transition'
import type { RecipeSummary } from '@/lib/domain/types'
import { prefetchPage } from '@/lib/navigation/prefetch'
import { useWarmOnView } from '@/lib/navigation/warm-on-view'
import type { LibraryIcons } from './icons'
import { highlightRanges, recipeMeta, type ViewMode } from './library-data'
import styles from './recipe-card.module.scss'
import { RecipeMedia } from './recipe-media'

export type CardAction = 'collections' | 'duplicate' | 'select' | 'remove' | 'delete'

const LABELS: Record<CardAction, string> = {
    collections: 'Add to collection',
    duplicate: 'Duplicate',
    select: 'Select',
    remove: 'Remove from collection',
    delete: 'Delete',
}

const ICON_FOR: Record<CardAction, keyof LibraryIcons> = {
    collections: 'collection',
    duplicate: 'copy',
    select: 'select',
    remove: 'remove',
    delete: 'delete',
}

export interface RecipeCardProps {
    recipe: RecipeSummary
    view: ViewMode
    tokens: string[]
    icons: LibraryIcons
    actions: CardAction[]
    selecting: boolean
    selected: boolean
    /** First rows load eagerly; the rest wait until they scroll near. */
    priority?: boolean
    onFavorite: (id: string, value: boolean) => void
    /** `range` extends the selection from the last toggled card (Shift-click). */
    onToggleSelect: (id: string, range: boolean) => void
    onAction: (action: CardAction, id: string) => void
}

function Highlighted({ text, tokens }: { text: string; tokens: string[] }) {
    const ranges = highlightRanges(text, tokens)
    if (ranges.length === 0) return text
    const parts: ReactNode[] = []
    let at = 0
    for (const [start, end] of ranges) {
        if (start > at) parts.push(text.slice(at, start))
        parts.push(<mark key={start}>{text.slice(start, end)}</mark>)
        at = end
    }
    if (at < text.length) parts.push(text.slice(at))
    return parts
}

const LONG_PRESS_MS = 450
const MOVE_TOLERANCE = 10

export function RecipeCard({
    recipe,
    view,
    tokens,
    icons,
    actions,
    selecting,
    selected,
    priority,
    onFavorite,
    onToggleSelect,
    onAction,
}: RecipeCardProps) {
    const router = useRouter()
    const press = useRef<{ timer: number; x: number; y: number } | null>(null)
    const swallowClick = useRef(false)
    const meta = recipeMeta(recipe)
    const { id } = recipe

    // The photo can only morph into the recipe page when that page renders in the same
    // commit, so warm the whole page on intent instead of only its loading shell.
    const warm = () => prefetchPage(router, `/recipe/${id}`)
    const cardRef = useRef<HTMLElement>(null)
    useWarmOnView(cardRef, warm, !selecting)

    const cancelPress = () => {
        if (press.current) window.clearTimeout(press.current.timer)
        press.current = null
    }

    // Touch: a long press starts selecting, as in Photos and Files.
    const onPointerDown = (event: PointerEvent) => {
        if (!selecting) warm()
        if (event.pointerType !== 'touch' || selecting) return
        const { clientX: x, clientY: y } = event
        cancelPress()
        press.current = {
            x,
            y,
            timer: window.setTimeout(() => {
                press.current = null
                swallowClick.current = true
                navigator.vibrate?.(8)
                onToggleSelect(id, false)
            }, LONG_PRESS_MS),
        }
    }

    const onPointerMove = (event: PointerEvent) => {
        const start = press.current
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_TOLERANCE) cancelPress()
    }

    const onLinkClick = (event: MouseEvent) => {
        if (swallowClick.current) {
            swallowClick.current = false
            event.preventDefault()
            return
        }
        if (selecting || event.shiftKey || event.metaKey || event.ctrlKey) {
            event.preventDefault()
            onToggleSelect(id, event.shiftKey)
        }
    }

    const photoSizes =
        view === 'list' ? '72px' : '(width < 600px) 50vw, (width < 1200px) 33vw, (width < 1600px) 20vw, 17vw'

    return (
        <article
            ref={cardRef}
            className={styles.card}
            data-view={view}
            data-selecting={selecting || undefined}
            data-selected={selected || undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={cancelPress}
            onPointerCancel={cancelPress}
            onContextMenu={(event) => {
                if (swallowClick.current || press.current) event.preventDefault()
            }}
        >
            <SharedElement name={vtName('recipe-photo', id)}>
                <div className={styles.media} {...morphTarget('photo', id)}>
                    <RecipeMedia src={recipe.thumbnail} title={recipe.title} sizes={photoSizes} priority={priority} />
                    <span className={styles.check} aria-hidden>
                        <svg viewBox="0 0 24 24" focusable="false" aria-hidden>
                            <path d="M9.55 17.65 4.2 12.3l1.4-1.4 3.95 3.95 8.85-8.85 1.4 1.4Z" />
                        </svg>
                    </span>
                </div>
            </SharedElement>
            <div className={styles.text}>
                <h3 className={styles.title}>
                    <TransitionLink
                        href={`/recipe/${id}`}
                        className={styles.link}
                        onClick={onLinkClick}
                        onPointerEnter={selecting ? undefined : warm}
                        onFocus={selecting ? undefined : warm}
                        draggable={!selecting}
                        role={selecting ? 'checkbox' : undefined}
                        aria-checked={selecting ? selected : undefined}
                    >
                        <Highlighted text={recipe.title} tokens={tokens} />
                    </TransitionLink>
                </h3>
                {meta && <p className={styles.meta}>{meta}</p>}
            </div>
            <div className={styles.actions}>
                <IconButton
                    className={styles.favorite}
                    label="Favorite"
                    size="xs"
                    icon={icons.favorite}
                    selectedIcon={icons.favoriteFilled}
                    selected={recipe.favorite}
                    onSelectedChange={(value) => onFavorite(id, value)}
                    disabled={selecting}
                />
                <Menu>
                    <MenuTrigger
                        render={
                            <IconButton
                                className={styles.more}
                                label={`More for ${recipe.title}`}
                                size="xs"
                                icon={icons.more}
                                disabled={selecting}
                            />
                        }
                    />
                    <MenuContent align="end">
                        {actions.map((action) => (
                            <MenuItemFor
                                key={action}
                                action={action}
                                icons={icons}
                                onSelect={() => onAction(action, id)}
                            />
                        ))}
                    </MenuContent>
                </Menu>
            </div>
        </article>
    )
}

function MenuItemFor({ action, icons, onSelect }: { action: CardAction; icons: LibraryIcons; onSelect: () => void }) {
    return (
        <>
            {action === 'delete' && <MenuSeparator />}
            <MenuItem icon={icons[ICON_FOR[action]]} onClick={onSelect}>
                {LABELS[action]}
            </MenuItem>
        </>
    )
}
