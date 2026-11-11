'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps } from 'react'
import { type NavDirection, transitionTypesFor } from '@/lib/theme/view-transition'

export interface TransitionLinkProps extends ComponentProps<typeof Link> {
    /** forward: deeper in the hierarchy; back: up; fade: across tabs. */
    direction?: NavDirection
}

/** next/link that tags the navigation so <PageTransition> picks the right motion. */
export function TransitionLink({ direction = 'forward', ...rest }: TransitionLinkProps) {
    return <Link transitionTypes={transitionTypesFor(direction)} {...rest} />
}

/** Router whose push/replace carry a direction for view transitions. */
export function useViewTransitionRouter() {
    const router = useRouter()
    return {
        ...router,
        push: (href: string, direction: NavDirection = 'forward', options?: { scroll?: boolean }) =>
            router.push(href, { ...options, transitionTypes: transitionTypesFor(direction) }),
        replace: (href: string, direction: NavDirection = 'fade', options?: { scroll?: boolean }) =>
            router.replace(href, { ...options, transitionTypes: transitionTypesFor(direction) }),
    }
}
