import type { HTMLAttributes } from 'react'

const style = {
    position: 'absolute',
    inlineSize: '1px',
    blockSize: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
    border: 0,
} as const

/** Text for assistive tech only. */
export function VisuallyHidden({ style: extra, ...rest }: HTMLAttributes<HTMLSpanElement>) {
    return <span style={{ ...style, ...extra }} {...rest} />
}
