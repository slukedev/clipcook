'use client'

import { Field } from '@base-ui/react/field'
import { cx } from '../cx'
import { Icon, type IconName } from '../icon'
import { IconButton } from '../icon-button'
import styles from './text-field.module.scss'

type InputAttributes = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'className' | 'style'>

interface TextFieldProps extends InputAttributes {
    label: string
    variant?: 'filled' | 'outlined'
    /** Helper line under the field. */
    supportingText?: string
    /** Error message — switches the field to its error state. */
    errorText?: string
    leadingIcon?: IconName
    trailingIcon?: IconName
    /** Makes the trailing icon an interactive button (e.g. clear). */
    onTrailingIconClick?: () => void
    trailingIconLabel?: string
    /** Render a textarea instead of an input. */
    multiline?: boolean
    rows?: number
    fullWidth?: boolean
    className?: string
}

/**
 * M3 text field (filled and outlined) on Base UI Field:
 * floating label, leading/trailing icons, supporting or error text.
 */
export function TextField({
    label,
    variant = 'filled',
    supportingText,
    errorText,
    leadingIcon,
    trailingIcon,
    onTrailingIconClick,
    trailingIconLabel,
    multiline = false,
    rows = 4,
    fullWidth = false,
    className,
    disabled,
    ...inputProps
}: TextFieldProps) {
    const invalid = Boolean(errorText)
    const resolvedTrailingIcon = invalid && !trailingIcon ? 'error' : trailingIcon

    return (
        <Field.Root
            disabled={disabled}
            invalid={invalid}
            className={cx(
                styles.field,
                styles[variant],
                invalid && styles.invalid,
                fullWidth && styles.fullWidth,
                multiline && styles.multiline,
                className,
            )}
        >
            <div className={styles.container}>
                {leadingIcon && <Icon name={leadingIcon} className={styles.leadingIcon} />}
                <div className={styles.content}>
                    <Field.Control
                        className={styles.input}
                        render={multiline ? <textarea rows={rows} /> : undefined}
                        {...(inputProps as React.ComponentProps<typeof Field.Control>)}
                    />
                    <Field.Label className={styles.label}>{label}</Field.Label>
                </div>
                {resolvedTrailingIcon &&
                    (onTrailingIconClick ? (
                        <IconButton
                            icon={resolvedTrailingIcon}
                            label={trailingIconLabel ?? 'Clear'}
                            onClick={onTrailingIconClick}
                            className={styles.trailingButton}
                        />
                    ) : (
                        <Icon name={resolvedTrailingIcon} className={styles.trailingIcon} />
                    ))}
                <div className={styles.outline} aria-hidden="true" />
            </div>
            {errorText ? (
                <span className={styles.supportingLine}>{errorText}</span>
            ) : (
                supportingText && <span className={styles.supportingLine}>{supportingText}</span>
            )}
        </Field.Root>
    )
}
