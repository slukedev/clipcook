'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { RecipeImage } from '@/components/recipe-image'
import { Shape } from '@/components/ui/shape'
import styles from './home.module.scss'

export interface HomeTile {
    id: string
    title: string
    thumbnail: string
    totalTime: string
}

const DIM_AFTER_MS = 3 * 60_000
const DRIFT_EVERY_MS = 4 * 60_000
const DRIFT_PX = 18
const REFRESH_EVERY_MS = 15 * 60_000

function subscribeMinute(onChange: () => void) {
    let timer: ReturnType<typeof setTimeout>
    const arm = () => {
        timer = setTimeout(
            () => {
                onChange()
                arm()
            },
            60_000 - (Date.now() % 60_000) + 50,
        )
    }
    arm()
    return () => clearTimeout(timer)
}

/** Current minute on this device's clock; null during SSR (the server has another time zone). */
function useMinute(): number | null {
    return useSyncExternalStore(
        subscribeMinute,
        () => Math.floor(Date.now() / 60_000),
        () => null,
    )
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

export function DisplayHome({
    name,
    favorites,
    recent,
    icons,
}: {
    name: string
    favorites: HomeTile[]
    recent: HomeTile[]
    icons: { recipe: ReactNode; time: ReactNode }
}) {
    const router = useRouter()
    const minute = useMinute()
    const [dim, setDim] = useState(false)
    const [drift, setDrift] = useState({ x: 0, y: 0 })
    const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const swallowClick = useRef(false)

    // Ambient mode: dim after a while with nobody touching it; any touch wakes it.
    useEffect(() => {
        const arm = () => {
            clearTimeout(idleTimer.current)
            idleTimer.current = setTimeout(() => setDim(true), DIM_AFTER_MS)
        }
        arm()
        window.addEventListener('pointerdown', arm, { passive: true })
        window.addEventListener('keydown', arm)
        return () => {
            clearTimeout(idleTimer.current)
            window.removeEventListener('pointerdown', arm)
            window.removeEventListener('keydown', arm)
        }
    }, [])

    // Burn-in care: the clock wanders a few pixels every few minutes.
    useEffect(() => {
        const id = setInterval(() => {
            setDrift({
                x: Math.round((Math.random() * 2 - 1) * DRIFT_PX),
                y: Math.round((Math.random() * 2 - 1) * DRIFT_PX),
            })
        }, DRIFT_EVERY_MS)
        return () => clearInterval(id)
    }, [])

    // New recipes show up without anyone reloading the display.
    useEffect(() => {
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') router.refresh()
        }, REFRESH_EVERY_MS)
        return () => clearInterval(id)
    }, [router])

    const now = minute === null ? null : new Date(minute * 60_000)

    return (
        <main
            className={styles.root}
            data-dim={dim || undefined}
            onPointerDownCapture={() => {
                if (!dim) return
                swallowClick.current = true
                setDim(false)
            }}
            onClickCapture={(event) => {
                // The touch that wakes the screen should not also open a recipe.
                if (!swallowClick.current) return
                swallowClick.current = false
                event.preventDefault()
                event.stopPropagation()
            }}
        >
            <section className={styles.clockPane} aria-label="Clock">
                <div className={styles.clock} style={{ transform: `translate(${drift.x}px, ${drift.y}px)` }}>
                    <time className={styles.time} dateTime={now?.toISOString()}>
                        {now ? <Clock date={now} /> : ' '}
                    </time>
                    <p className={styles.date}>{now ? dateFormat.format(now) : ' '}</p>
                    <h1 className={styles.name}>{name}</h1>
                </div>
            </section>

            <div className={styles.tilesPane} aria-hidden={dim || undefined}>
                {favorites.length + recent.length === 0 ? (
                    <div className={styles.empty}>
                        <Shape name="cookie9" className={styles.emptyShape} />
                        <p>Send a recipe from any signed-in device</p>
                    </div>
                ) : (
                    <>
                        {favorites.length > 0 && <TileSection title="Favorites" tiles={favorites} icons={icons} />}
                        {recent.length > 0 && <TileSection title="Recent" tiles={recent} icons={icons} />}
                    </>
                )}
            </div>
        </main>
    )
}

function TileSection({
    title,
    tiles,
    icons,
}: {
    title: string
    tiles: HomeTile[]
    icons: { recipe: ReactNode; time: ReactNode }
}) {
    return (
        <section className={styles.section} aria-label={title}>
            <h2 className={styles.sectionTitle}>{title}</h2>
            <ul className={styles.tiles}>
                {tiles.map((tile) => (
                    <li key={tile.id}>
                        <Link href={`/display/r/${tile.id}`} className={styles.tile}>
                            <span className={styles.tilePhoto}>
                                {tile.thumbnail ? (
                                    <RecipeImage
                                        src={tile.thumbnail}
                                        alt=""
                                        sizes="(orientation: portrait) 50vw, 25vw"
                                    />
                                ) : (
                                    <span className={styles.tileFallback}>{icons.recipe}</span>
                                )}
                            </span>
                            <span className={styles.tileTitle}>{tile.title}</span>
                            {tile.totalTime && (
                                <span className={styles.tileMeta}>
                                    {icons.time}
                                    {tile.totalTime}
                                </span>
                            )}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    )
}

/** Hours and minutes large; AM/PM small beside them, where the locale uses it. */
function Clock({ date }: { date: Date }) {
    const parts = timeFormat.formatToParts(date)
    const main = parts
        .filter((p) => p.type !== 'dayPeriod')
        .map((p) => p.value)
        .join('')
        .trim()
    const period = parts.find((p) => p.type === 'dayPeriod')?.value
    return (
        <>
            {main}
            {period && <span className={styles.dayPeriod}>{period}</span>}
        </>
    )
}
