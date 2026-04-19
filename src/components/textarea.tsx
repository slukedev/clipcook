'use client'

import type { TextareaHTMLAttributes } from 'react'
import styles from '@/styles/Components.module.scss'
import { Icon } from '@/components/icon'

interface TextareaExtras {
    label: string
    name: string
    icon?: string
    fullwidth?: boolean
}

type TextareaProps = TextareaExtras & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'>

export function Textarea({ label, name, icon, fullwidth, className, ...rest }: TextareaProps) {
    return (
        <div
            className={`${styles.input} ${styles.textarea} ${icon ? styles.icon : ''} ${className ?? ''}`}
            style={fullwidth ? { width: '100%' } : undefined}
        >
            {icon ? <Icon name={icon} iconsize="24" className={styles.icon} /> : null}
            <textarea {...rest} name={name} placeholder=" " />
            <label htmlFor={rest.id ?? name}>{label}</label>
        </div>
    )
}
