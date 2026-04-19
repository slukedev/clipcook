'use client'

import type { HTMLAttributes, MouseEvent as ReactMouseEvent } from 'react'
import styles from '@/styles/Components.module.scss'

interface RippleProps extends HTMLAttributes<HTMLDivElement> {
    feather?: string
    speedms?: number
    color?: string
    unbounded?: boolean
    dontfade?: boolean
}

export function Ripple({
    feather,
    speedms,
    color,
    unbounded,
    dontfade,
    className,
    children,
    onMouseDown,
    ...rest
}: RippleProps) {
    function createRipple(event: ReactMouseEvent<HTMLDivElement>) {
        onMouseDown?.(event)
        const target = event.currentTarget
        const rect = target.getBoundingClientRect()
        const ripple = document.createElement('span')
        if (styles.ripple) ripple.classList.add(styles.ripple)

        const diameter = Math.max(target.clientWidth, target.clientHeight)
        const radius = diameter / 2

        ripple.style.width = `${diameter}px`
        ripple.style.height = `${diameter}px`

        const x = event.clientX - rect.left
        const y = event.clientY - rect.top

        if (unbounded) {
            ripple.style.top = '0'
            ripple.style.left = '0'
            ripple.style.transform = 'translate(-50%, -50%)'
        } else {
            ripple.style.top = `${y - radius}px`
            ripple.style.left = `${x - radius}px`
        }

        if (feather) ripple.style.filter = `blur(${feather})`
        if (speedms) ripple.style.animationDuration = `${speedms}ms`
        if (color) ripple.style.backgroundColor = color
        if (dontfade) ripple.style.opacity = '1'

        target.appendChild(ripple)

        const removeTimeout = window.setTimeout(() => {
            ripple.remove()
        }, speedms ?? 600)

        if (dontfade) {
            const onDocClick = (e: MouseEvent) => {
                if (e.target !== target) {
                    ripple.remove()
                    document.removeEventListener('click', onDocClick)
                    window.clearTimeout(removeTimeout)
                }
            }
            document.addEventListener('click', onDocClick)
        }
    }

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: decorative wrapper; real interaction lives on the child element
        <div
            {...rest}
            onMouseDown={createRipple}
            className={`${styles.ripplecontainer ?? ''} ${className ?? ''}`.trim()}
        >
            {children}
        </div>
    )
}
