import type { CSSProperties, HTMLAttributes, SVGProps } from 'react'
import { cx } from '../cx'
import styles from './shape.module.scss'
import { SHAPE_PATHS, type ShapeName } from './shape-paths'

/** The curated set offered to pages. Every MaterialShape is still available by name. */
export const SHAPES = Object.keys(SHAPE_PATHS) as ShapeName[]

const maskCache = new Map<ShapeName, string>()

/** A CSS mask for any element, such as a photo cut into a cookie. */
export function shapeMask(name: ShapeName): string {
    let mask = maskCache.get(name)
    if (!mask) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${SHAPE_PATHS[name]}"/></svg>`
        mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}") center / 100% 100% no-repeat`
        maskCache.set(name, mask)
    }
    return mask
}

interface ShapeSvgProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'name'> {
    name: ShapeName
    /** Width and height in px (or any CSS length). Defaults to `--md-shape-size`, else 48px. */
    size?: number | string
    /** Accessible name; decorative when omitted. */
    label?: string
    children?: undefined
}

interface ShapeContainerProps extends HTMLAttributes<HTMLDivElement> {
    name: ShapeName
    size?: number | string
    label?: string
    /** Content clipped to the shape: a photo, an avatar, an icon on a tinted fill. */
    children: React.ReactNode
}

export type ShapeProps = ShapeSvgProps | ShapeContainerProps

function sizeStyle(size: number | string | undefined, style: CSSProperties | undefined): CSSProperties | undefined {
    if (size === undefined) return style
    return { ...style, '--md-shape-size': typeof size === 'number' ? `${size}px` : size } as CSSProperties
}

/**
 * One of the 35 M3 Expressive MaterialShapes. Without children it draws the shape
 * in `currentColor`; with children it clips them to the shape with a CSS mask.
 */
export function Shape(props: ShapeProps) {
    if (props.children !== undefined) {
        const { name, size, label, className, style, children, ...rest } = props as ShapeContainerProps
        return (
            <div
                role={label ? 'img' : undefined}
                aria-label={label}
                data-shape={name}
                className={cx(styles.container, className)}
                style={{ ...sizeStyle(size, style), mask: shapeMask(name), WebkitMask: shapeMask(name) }}
                {...rest}
            >
                {children}
            </div>
        )
    }
    const { name, size, label, className, style, ...rest } = props as ShapeSvgProps
    return (
        <svg
            viewBox="0 0 100 100"
            role={label ? 'img' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
            focusable="false"
            data-shape={name}
            className={cx(styles.shape, className)}
            style={sizeStyle(size, style)}
            {...rest}
        >
            <path d={SHAPE_PATHS[name]} />
        </svg>
    )
}
