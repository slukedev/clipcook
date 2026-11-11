'use client'

import { Children, type HTMLAttributes, type ReactNode, useEffect, useRef, useState } from 'react'
import { cx } from '../cx'
import { Glyph } from '../icon/glyph'
import { IconButton } from '../icon-button/icon-button'
import styles from './carousel.module.scss'

export interface CarouselProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
    /** multi-browse: several items with the edges masked; hero: one large item; uncontained: fixed widths. */
    variant?: 'multi-browse' | 'hero' | 'uncontained'
    /** Accessible name for the carousel region. */
    label: string
    children: ReactNode
}

const VARIANT = { 'multi-browse': styles.multi, hero: styles.hero, uncontained: styles.uncontained }

/**
 * M3 carousel on native scroll snapping: swipe, trackpad, arrow keys when focused,
 * plus previous/next buttons on pointer devices.
 */
export function Carousel({ variant = 'multi-browse', label, className, children, ...rest }: CarouselProps) {
    const trackRef = useRef<HTMLDivElement>(null)
    const [edges, setEdges] = useState({ start: true, end: false })
    const items = Children.toArray(children)

    useEffect(() => {
        const track = trackRef.current
        if (!track) return
        const update = () => {
            const max = track.scrollWidth - track.clientWidth
            const x = Math.abs(track.scrollLeft)
            setEdges({ start: x < 4, end: x > max - 4 })
        }
        update()
        track.addEventListener('scroll', update, { passive: true })
        const resize = new ResizeObserver(update)
        resize.observe(track)
        return () => {
            track.removeEventListener('scroll', update)
            resize.disconnect()
        }
    }, [])

    const page = (direction: 1 | -1) => {
        const track = trackRef.current
        const first = track?.firstElementChild as HTMLElement | null
        if (!track || !first) return
        const rtl = getComputedStyle(track).direction === 'rtl' ? -1 : 1
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        track.scrollBy({ left: direction * rtl * (first.offsetWidth + 8), behavior: reduce ? 'auto' : 'smooth' })
    }

    return (
        <section aria-roledescription="carousel" aria-label={label} className={cx(styles.root, className)} {...rest}>
            {/* biome-ignore lint/a11y/noNoninteractiveTabindex: scroll region must be keyboard scrollable */}
            <div ref={trackRef} className={cx(styles.track, VARIANT[variant])} tabIndex={0}>
                {items.map((item, index) => (
                    // biome-ignore lint/a11y/useSemanticElements: APG carousel slides are role=group with a roledescription
                    <div
                        // biome-ignore lint/suspicious/noArrayIndexKey: children order is the identity
                        key={index}
                        className={styles.item}
                        role="group"
                        aria-roledescription="slide"
                        aria-label={`${index + 1} of ${items.length}`}
                    >
                        {item}
                    </div>
                ))}
            </div>
            <div className={cx(styles.nav, styles.prev)} data-hidden={edges.start || undefined}>
                <IconButton
                    label="Previous"
                    variant="tonal"
                    icon={<Glyph name="chevron_right" style={{ rotate: '180deg' }} />}
                    onClick={() => page(-1)}
                    tabIndex={-1}
                />
            </div>
            <div className={cx(styles.nav, styles.next)} data-hidden={edges.end || undefined}>
                <IconButton
                    label="Next"
                    variant="tonal"
                    icon={<Glyph name="chevron_right" />}
                    onClick={() => page(1)}
                    tabIndex={-1}
                />
            </div>
        </section>
    )
}
