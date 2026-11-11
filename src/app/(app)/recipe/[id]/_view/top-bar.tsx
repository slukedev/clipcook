'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { IconButton } from '@/components/ui/icon-button'
import { transitionTypesFor } from '@/lib/theme/view-transition'
import styles from './top-bar.module.scss'

interface NavigationLike {
    canGoBack?: boolean
}

/**
 * The recipe page's own top app bar. It floats over the photo on compact windows, picks up
 * the surface-container fill once the photo scrolls under it, and shows the title once
 * the page's h1 is out of view.
 */
export function TopBar({
    title,
    titleId,
    back,
    trailing,
}: {
    title: string
    titleId: string
    back: ReactNode
    trailing: ReactNode
}) {
    const router = useRouter()
    const ref = useRef<HTMLDivElement>(null)
    const [titleVisible, setTitleVisible] = useState(false)
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const heading = document.getElementById(titleId)
        const bar = ref.current
        if (!heading || !bar) return
        const barHeight = bar.offsetHeight
        const titleObserver = new IntersectionObserver(
            ([entry]) =>
                setTitleVisible(entry ? !entry.isIntersecting && entry.boundingClientRect.top < barHeight : false),
            { rootMargin: `-${barHeight}px 0px 0px 0px` },
        )
        titleObserver.observe(heading)
        // Fill in once content reaches the bar: the summary sheet over a photo, else any scroll.
        const sentinel = document.querySelector<HTMLElement>('[data-bar-sentinel]')
        let overPhoto = false
        const measure = () => {
            overPhoto = getComputedStyle(bar).getPropertyValue('--_over-photo').trim() === '1'
        }
        const onScroll = () => {
            if (window.scrollY <= 4) setScrolled(false)
            else setScrolled(!overPhoto || !sentinel || sentinel.getBoundingClientRect().top <= barHeight)
        }
        measure()
        window.addEventListener('resize', measure, { passive: true })
        onScroll()
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            titleObserver.disconnect()
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', measure)
        }
    }, [titleId])

    // Back goes back when there is an in-app page behind us; otherwise to the library.
    const onBack = (event: MouseEvent<HTMLAnchorElement>) => {
        const nav = (window as unknown as { navigation?: NavigationLike }).navigation
        if (nav?.canGoBack) {
            event.preventDefault()
            router.back()
        }
    }

    return (
        <div
            ref={ref}
            className={styles.bar}
            data-scrolled={scrolled || undefined}
            data-title-visible={titleVisible || undefined}
        >
            <IconButton
                className={styles.action}
                label="Back"
                icon={back}
                render={<Link href="/" transitionTypes={transitionTypesFor('back')} onClick={onBack} />}
                nativeButton={false}
            />
            <p className={styles.title} aria-hidden>
                {title}
            </p>
            <div className={styles.trailing}>{trailing}</div>
        </div>
    )
}
