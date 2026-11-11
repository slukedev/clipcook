import Link from 'next/link'
import type { ComponentProps, HTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx'
import { Ripple } from '../ripple/ripple'
import styles from './list.module.scss'

export interface ListProps extends HTMLAttributes<HTMLUListElement> {
    /** Expressive segmented list: grouped rows with 2dp gaps and rounded ends. */
    segmented?: boolean
    /** Accessible name. */
    label?: string
}

export function List({ segmented = false, label, className, children, ...rest }: ListProps) {
    return (
        <ul
            // biome-ignore lint/a11y/noRedundantRoles: Safari drops list semantics once list-style is none
            role="list"
            aria-label={label}
            data-segmented={segmented || undefined}
            className={cx(styles.list, className)}
            {...rest}
        >
            {children}
        </ul>
    )
}

interface ItemContent {
    headline: ReactNode
    supporting?: ReactNode
    overline?: ReactNode
    /** Icon (20 to 24dp), avatar (40dp), image (56dp) or a control. */
    leading?: ReactNode
    /** Icon, control or meta. */
    trailing?: ReactNode
    /** Short trailing text such as a count or time. */
    trailingText?: ReactNode
    /** Force the row height class; otherwise inferred from the content. */
    lines?: 1 | 2 | 3
    selected?: boolean
    disabled?: boolean
    className?: string
    /** Props for the <li>. */
    itemProps?: HTMLAttributes<HTMLLIElement>
}

export type ListItemProps =
    | (ItemContent & { href: string; onClick?: undefined; as?: undefined } & Omit<
              ComponentProps<typeof Link>,
              'className' | 'children'
          >)
    | (ItemContent & { href?: undefined; onClick: ComponentProps<'button'>['onClick']; as?: undefined })
    | (ItemContent & {
          href?: undefined
          onClick?: undefined
          /** `label` makes the whole row the label of a control in `leading`/`trailing`. */
          as?: 'div' | 'label'
          htmlFor?: string
      })

function Content({ headline, supporting, overline, leading, trailing, trailingText }: ItemContent) {
    return (
        <>
            {leading && <span className={styles.leading}>{leading}</span>}
            <span className={styles.text}>
                {overline && <span className={styles.overline}>{overline}</span>}
                <span className={styles.headline}>{headline}</span>
                {supporting && <span className={styles.supporting}>{supporting}</span>}
            </span>
            {trailingText && <span className={styles.trailingText}>{trailingText}</span>}
            {trailing && <span className={styles.trailing}>{trailing}</span>}
        </>
    )
}

/** One-, two- or three-line list row. A link with `href`, a button with `onClick`. */
export function ListItem(props: ListItemProps) {
    const {
        headline,
        supporting,
        overline,
        leading,
        trailing,
        trailingText,
        lines,
        selected,
        disabled,
        className,
        itemProps,
    } = props
    const inferred = lines ?? (overline && supporting ? 3 : supporting || overline ? 2 : 1)
    const shared = {
        className: cx(styles.row, className),
        'data-lines': inferred,
        'data-selected': selected || undefined,
        'data-disabled': disabled || undefined,
    }
    const content = (
        <Content
            headline={headline}
            supporting={supporting}
            overline={overline}
            leading={leading}
            trailing={trailing}
            trailingText={trailingText}
        />
    )
    let row: ReactNode
    if (props.href !== undefined) {
        const {
            headline: _h,
            supporting: _s,
            overline: _o,
            leading: _l,
            trailing: _t,
            trailingText: _tt,
            lines: _li,
            selected: _se,
            disabled: _d,
            className: _c,
            itemProps: _ip,
            ...link
        } = props
        row = (
            <Link {...link} {...shared} data-interactive="" aria-current={selected ? 'page' : undefined}>
                <Ripple />
                {content}
            </Link>
        )
    } else if (props.onClick !== undefined) {
        row = (
            <button
                type="button"
                {...shared}
                data-interactive=""
                onClick={props.onClick}
                disabled={disabled}
                aria-pressed={selected}
            >
                <Ripple />
                {content}
            </button>
        )
    } else if (props.as === 'label') {
        row = (
            <label {...shared} htmlFor={props.htmlFor} data-interactive="">
                <Ripple />
                {content}
            </label>
        )
    } else {
        row = <div {...shared}>{content}</div>
    }
    return (
        <li {...itemProps} className={cx(styles.item, itemProps?.className)}>
            {row}
        </li>
    )
}
