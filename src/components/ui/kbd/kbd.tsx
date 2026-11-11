import type { HTMLAttributes } from 'react'
import { cx } from '../cx'
import styles from './kbd.module.scss'

/** A keyboard key, for shortcut hints in menus and tooltips. */
export function Kbd({ className, ...rest }: HTMLAttributes<HTMLElement>) {
    return <kbd className={cx(styles.kbd, className)} {...rest} />
}
