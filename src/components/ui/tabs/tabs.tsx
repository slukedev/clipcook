'use client'

import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import { type ComponentProps, type ReactNode, useEffect, useRef } from 'react'
import { cx } from '../cx'
import { Divider } from '../divider/divider'
import { Ripple } from '../ripple/ripple'
import styles from './tabs.module.scss'

export interface TabsProps extends Omit<ComponentProps<typeof BaseTabs.Root>, 'className'> {
    className?: string
}

/** Tabs root; holds a `TabList` and `TabPanel`s. */
export function Tabs({ className, ...rest }: TabsProps) {
    return <BaseTabs.Root className={cx(styles.root, className)} {...rest} />
}

export interface TabListProps {
    /** Primary tabs sit under the app bar; secondary tabs subdivide a section. */
    variant?: 'primary' | 'secondary'
    /** Scroll instead of sharing the width (many tabs, compact windows). */
    scrollable?: boolean
    /** Accessible name. */
    label?: string
    children: ReactNode
    className?: string
}

export function TabList({ variant = 'primary', scrollable = false, label, children, className }: TabListProps) {
    const ref = useRef<HTMLDivElement>(null)

    // Primary indicators match the active label's width, not the tab's.
    useEffect(() => {
        const list = ref.current
        if (!list || variant !== 'primary') return
        const measure = () => {
            const content = list.querySelector<HTMLElement>('[data-active] [data-tab-content]')
            if (content) list.style.setProperty('--_content', `${content.offsetWidth}px`)
        }
        measure()
        const mutations = new MutationObserver(measure)
        mutations.observe(list, { attributes: true, subtree: true, attributeFilter: ['data-active'] })
        const resize = new ResizeObserver(measure)
        resize.observe(list)
        return () => {
            mutations.disconnect()
            resize.disconnect()
        }
    }, [variant])

    return (
        <div data-variant={variant}>
            <BaseTabs.List
                ref={ref}
                aria-label={label}
                className={cx(styles.list, className)}
                data-scrollable={scrollable || undefined}
            >
                {children}
                <BaseTabs.Indicator className={styles.indicator} />
            </BaseTabs.List>
            <Divider />
        </div>
    )
}

export interface TabProps extends Omit<ComponentProps<typeof BaseTabs.Tab>, 'className' | 'children'> {
    icon?: ReactNode
    children: ReactNode
    className?: string
}

export function Tab({ icon, children, className, ...rest }: TabProps) {
    return (
        <BaseTabs.Tab className={cx(styles.tab, className)} data-has-icon={icon ? '' : undefined} {...rest}>
            <Ripple />
            <span className={styles.content} data-tab-content="">
                {icon}
                {children}
            </span>
        </BaseTabs.Tab>
    )
}

export function TabPanel({ className, ...rest }: Omit<ComponentProps<typeof BaseTabs.Panel>, 'className'> & { className?: string }) {
    return <BaseTabs.Panel className={cx(styles.panel, className)} {...rest} />
}
