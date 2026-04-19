'use client'

import type { InputHTMLAttributes } from 'react'
import styles from '@/styles/Components.module.scss'

interface CheckboxExtras {
    inputid: string
}

type CheckboxProps = CheckboxExtras & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'>

export function Checkbox({ inputid, ...rest }: CheckboxProps) {
    return (
        <div className={styles.checkboxContainer}>
            <input type="checkbox" id={inputid} {...rest} />
            <label htmlFor={inputid}>
                <svg viewBox="0 0 24 24">
                    <path fill="none" stroke="white" d="M1.73,12.91 8.1,19.28 22.79,4.59"></path>
                </svg>
            </label>
        </div>
    )
}
