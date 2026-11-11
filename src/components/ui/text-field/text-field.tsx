'use client'

import { Field } from '@base-ui/react/field'
import { type CSSProperties, type InputHTMLAttributes, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { cx } from '../cx'
import styles from './text-field.module.scss'

type NativeProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'size' | 'className'>

export interface TextFieldProps extends NativeProps {
    label?: string
    variant?: 'filled' | 'outlined'
    /** Help below the field. Replaced by `error` when there is one. */
    supportingText?: ReactNode
    /** Error message; also marks the field invalid. */
    error?: string
    prefix?: ReactNode
    suffix?: ReactNode
    leadingIcon?: ReactNode
    /** Icon or IconButton (clear, visibility). */
    trailingIcon?: ReactNode
    /** Grows with its content between `rows` and `maxRows`. */
    multiline?: boolean
    rows?: number
    maxRows?: number
    /** Show `length / maxLength` under the field. */
    counter?: boolean
    className?: string
    /** For the outlined label cutout when the field sits on another surface. */
    surfaceColor?: string
}

/** M3 text field with a floating label, supporting or error text and a counter. */
export function TextField({
    label,
    variant = 'filled',
    supportingText,
    error,
    prefix,
    suffix,
    leadingIcon,
    trailingIcon,
    multiline = false,
    rows = 2,
    maxRows = 12,
    counter = false,
    className,
    surfaceColor,
    disabled,
    placeholder,
    onChange,
    onFocus,
    onBlur,
    ...input
}: TextFieldProps) {
    const id = useId()
    const controlRef = useRef<HTMLInputElement>(null)
    const initial = String(input.value ?? input.defaultValue ?? '')
    const [length, setLength] = useState(initial.length)
    const filled = (input.value !== undefined ? String(input.value) : null)?.length ?? length
    // Focus floats the label in CSS (:focus-within), so a field focused before
    // hydration (autoFocus) floats too. This covers values and a prefix.
    const floating = filled > 0 || Boolean(prefix && placeholder)

    // Firefox and Safari lack field-sizing; grow the textarea by hand there.
    useEffect(() => {
        const el = controlRef.current
        if (!multiline || !el || CSS.supports('field-sizing', 'content')) return
        const grow = () => {
            el.style.height = 'auto'
            el.style.height = `${el.scrollHeight}px`
        }
        grow()
        el.addEventListener('input', grow)
        return () => el.removeEventListener('input', grow)
    }, [multiline])

    const supporting = error ?? supportingText
    return (
        <Field.Root
            className={cx(styles.field, className)}
            data-variant={variant}
            data-has-label={label ? '' : undefined}
            data-floating={floating || undefined}
            data-multiline={multiline || undefined}
            invalid={Boolean(error)}
            disabled={disabled}
            style={
                {
                    '--_rows': rows,
                    '--_max-rows': maxRows,
                    ...(surfaceColor ? { '--md-text-field-surface': surfaceColor } : {}),
                } as CSSProperties
            }
        >
            {/* biome-ignore lint/a11y/noStaticElementInteractions: forwards clicks on padding to the input */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users land on the input directly */}
            <div className={styles.container} onClick={() => controlRef.current?.focus()}>
                {leadingIcon && <span className={styles.leading}>{leadingIcon}</span>}
                <div className={styles.inputArea}>
                    {label && <Field.Label className={styles.label}>{label}</Field.Label>}
                    <div className={styles.row}>
                        {prefix && <span className={styles.affix}>{prefix}</span>}
                        <Field.Control
                            ref={controlRef}
                            className={styles.input}
                            // A blank placeholder lets CSS see autofilled and uncontrolled values (:placeholder-shown).
                            placeholder={placeholder ?? (label ? ' ' : undefined)}
                            render={multiline ? <textarea rows={rows} /> : undefined}
                            onFocus={onFocus as never}
                            onBlur={onBlur as never}
                            onChange={(event) => {
                                setLength(event.currentTarget.value.length)
                                onChange?.(event as unknown as React.ChangeEvent<HTMLInputElement>)
                            }}
                            aria-describedby={supporting || counter ? `${id}-support` : undefined}
                            {...(input as object)}
                        />
                        {suffix && <span className={styles.affix}>{suffix}</span>}
                    </div>
                </div>
                {trailingIcon && <span className={styles.trailing}>{trailingIcon}</span>}
            </div>
            {(supporting || counter) && (
                <div className={styles.supporting} id={`${id}-support`}>
                    <span className={styles.supportingText} role={error ? 'alert' : undefined}>
                        {supporting}
                    </span>
                    {counter && input.maxLength !== undefined && (
                        <span className={styles.counter}>
                            {filled} / {input.maxLength}
                        </span>
                    )}
                </div>
            )}
        </Field.Root>
    )
}
