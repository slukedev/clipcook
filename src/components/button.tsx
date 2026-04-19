'use client'

import styles from '@/styles/Components.module.scss'
import { Ripple } from './ripple'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export function Button(props: ButtonProps) {
    return (
        <Ripple feather="5px" style={{ borderRadius: 20 }}>
            <button type="button" className={styles.button} {...props}>
                {props.children}
            </button>
        </Ripple>
    )
}
