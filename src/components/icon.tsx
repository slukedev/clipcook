'use client'

import type { HTMLAttributes } from 'react'

interface IconProps extends HTMLAttributes<HTMLSpanElement> {
    name: string
    fill?: '0' | '1'
    weight?: '100' | '200' | '300' | '400' | '500' | '600' | '700'
    grade?: string
    iconsize?: string
    color?: string
}

export function Icon({
    name,
    fill = '0',
    weight = '400',
    grade = '0',
    iconsize = '48',
    color,
    className,
    style,
    ...rest
}: IconProps) {
    return (
        <span
            {...rest}
            style={{
                ...style,
                fontVariationSettings: `'FILL' ${fill}, 'wght' ${weight},'GRAD' ${grade}, 'opsz' ${iconsize}`,
                fontSize: `${iconsize}px`,
                color,
            }}
            className={`material-symbols-outlined ${className ?? ''}`}
        >
            {name}
        </span>
    )
}
