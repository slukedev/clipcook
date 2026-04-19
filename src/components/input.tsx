'use client'

import type { InputHTMLAttributes } from 'react'
import styles from '@/styles/Components.module.scss'
import { Icon } from '@/components/icon'

interface InputExtras {
    label: string
    name: string
    type: string
    icon?: string
    fullwidth?: boolean
}

type InputProps = InputExtras & Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'type'>

export function Input({ label, name, type, icon, fullwidth, className, ...rest }: InputProps) {
    return (
        <div
            className={`${styles.input} ${icon ? styles.icon : ''} ${className ?? ''}`}
            style={fullwidth ? { width: '100%' } : undefined}
        >
            {icon ? <Icon name={icon} iconsize="24" className={styles.icon} /> : null}
            <input {...rest} name={name} type={type} placeholder=" " />
            <label htmlFor={rest.id ?? name}>{label}</label>
        </div>
    )
}
