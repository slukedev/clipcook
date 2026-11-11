import Link from 'next/link'
import type { ComponentProps, HTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx'
import { Ripple } from '../ripple/ripple'
import styles from './card.module.scss'

export type CardVariant = 'elevated' | 'filled' | 'outlined'

interface Base {
    variant?: CardVariant
    className?: string
    children: ReactNode
}

export type CardProps =
    | (Base &
          HTMLAttributes<HTMLElement> & {
              href?: undefined
              onClick?: undefined
              as?: 'div' | 'article' | 'section' | 'li'
          })
    | (Base & Omit<ComponentProps<typeof Link>, 'className' | 'children'> & { href: string })
    | (Base &
          Omit<ComponentProps<'button'>, 'className' | 'children'> & {
              href?: undefined
              onClick: ComponentProps<'button'>['onClick']
          })

/**
 * M3 card. With `href` it is a link, with `onClick` a button: both get a state
 * layer, ripple and focus ring. Otherwise a plain container.
 */
export function Card(props: CardProps) {
    const { variant = 'filled', className, children } = props
    const classes = (interactive: boolean) =>
        cx(styles.card, styles[variant], interactive && styles.interactive, className)
    if (props.href !== undefined) {
        const { variant: _v, className: _c, children: _ch, ...link } = props as Extract<CardProps, { href: string }>
        return (
            <Link {...link} className={classes(true)}>
                <Ripple />
                {children}
            </Link>
        )
    }
    if (props.onClick !== undefined) {
        const {
            variant: _v,
            className: _c,
            children: _ch,
            ...button
        } = props as Extract<CardProps, { onClick: unknown }> & ComponentProps<'button'>
        return (
            <button type="button" {...button} className={classes(true)}>
                <Ripple />
                {children}
            </button>
        )
    }
    const {
        variant: _v,
        className: _c,
        children: _ch,
        as: Tag = 'div',
        ...rest
    } = props as Extract<CardProps, { as?: string }>
    return (
        <Tag {...rest} className={classes(false)}>
            {children}
        </Tag>
    )
}
