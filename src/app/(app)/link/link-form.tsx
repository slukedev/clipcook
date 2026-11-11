'use client'

import Link from 'next/link'
import { type ReactNode, useRef, useState, useTransition } from 'react'
import { claimDisplayCode } from '@/actions/displays'
import { Button } from '@/components/ui/button'
import { ChipSet, FilterChip } from '@/components/ui/chip'
import { MorphShape } from '@/components/ui/shape'
import { TextField } from '@/components/ui/text-field'
import type { KitchenDisplay } from '@/lib/domain/types'
import { LIMITS } from '@/lib/domain/types'
import { CODE_LENGTH, normalizeCode } from './code'
import styles from './link.module.scss'

const SUGGESTIONS = ['Kitchen', 'Counter', 'Fridge', 'Living room']

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()

/** 'Kitchen', or 'Kitchen 2' when a display already has that name, so every name picks one screen. */
function freeName(base: string, taken: readonly string[]): string {
    if (!taken.some((t) => sameName(t, base))) return base
    for (let n = 2; ; n++) {
        const candidate = `${base} ${n}`
        if (!taken.some((t) => sameName(t, candidate))) return candidate
    }
}
const SLOTS = Array.from({ length: CODE_LENGTH }, (_, i) => i)

interface Icons {
    display: ReactNode
    done: ReactNode
    send: ReactNode
    error: ReactNode
}

export function LinkForm({
    initialCode,
    taken,
    icons,
}: {
    initialCode: string
    /** Names already on this account's displays. */
    taken: readonly string[]
    icons: Icons
}) {
    const [code, setCode] = useState(initialCode)
    const [name, setName] = useState(() => freeName('Kitchen', taken))
    const [error, setError] = useState<string | null>(null)
    const [linked, setLinked] = useState<KitchenDisplay | null>(null)
    const [focused, setFocused] = useState(false)
    const [pending, startTransition] = useTransition()
    const inputRef = useRef<HTMLInputElement>(null)
    const complete = code.length === CODE_LENGTH
    const clash = taken.some((t) => sameName(t, name.trim() || 'Kitchen'))

    function submit() {
        if (!complete || pending || clash) return
        setError(null)
        startTransition(async () => {
            const res = await claimDisplayCode(code, name.trim() || 'Kitchen')
            if (res.ok) setLinked(res.data)
            else {
                setError(res.error)
                inputRef.current?.focus()
            }
        })
    }

    const shape = linked ? 'sunny' : pending ? 'cookie12' : error ? 'puffy' : 'cookie9'

    return (
        // A div, not main: the app shell already provides the page's main landmark.
        <div className={styles.main}>
            <div className={styles.art} data-state={linked ? 'done' : error ? 'error' : 'idle'} aria-hidden>
                <MorphShape shape={shape} className={styles.artShape} />
                <span className={styles.artIcon} data-hidden={linked ? '' : undefined}>
                    {icons.display}
                </span>
                <span className={styles.artIcon} data-hidden={linked ? undefined : ''}>
                    {icons.done}
                </span>
            </div>

            {linked ? (
                <section className={styles.success} aria-live="polite">
                    <h2 className={styles.successTitle}>{linked.name} is ready</h2>
                    <div className={styles.successActions}>
                        <Button size="m" icon={icons.send} render={<Link href="/" />} nativeButton={false}>
                            Send a recipe
                        </Button>
                        <Button
                            size="m"
                            variant="text"
                            render={<Link href="/settings/displays" />}
                            nativeButton={false}
                        >
                            Done
                        </Button>
                    </div>
                </section>
            ) : (
                <form
                    className={styles.form}
                    onSubmit={(event) => {
                        event.preventDefault()
                        submit()
                    }}
                >
                    <div className={styles.codeField}>
                        <label htmlFor="display-code" className={styles.codeLabel}>
                            Code on the display
                        </label>
                        <div
                            className={styles.code}
                            data-focused={focused || undefined}
                            data-invalid={error ? '' : undefined}
                        >
                            <input
                                ref={inputRef}
                                id="display-code"
                                className={styles.codeInput}
                                value={code}
                                onChange={(event) => {
                                    setCode(normalizeCode(event.target.value).slice(0, CODE_LENGTH))
                                    setError(null)
                                }}
                                onFocus={() => setFocused(true)}
                                onBlur={() => setFocused(false)}
                                // The caret always sits at the end; slots fill left to right.
                                onSelect={(event) => {
                                    const el = event.currentTarget
                                    if (el.selectionStart !== el.value.length) {
                                        el.setSelectionRange(el.value.length, el.value.length)
                                    }
                                }}
                                // biome-ignore lint/a11y/noAutofocus: entering the code is the only task here
                                autoFocus={!initialCode}
                                autoComplete="one-time-code"
                                autoCapitalize="characters"
                                autoCorrect="off"
                                spellCheck={false}
                                inputMode="text"
                                enterKeyHint="go"
                                maxLength={CODE_LENGTH + 4}
                                aria-invalid={error ? true : undefined}
                                aria-describedby={error ? 'display-code-error' : undefined}
                            />
                            <div className={styles.slots} aria-hidden>
                                {SLOTS.map((i) => (
                                    <span
                                        key={i}
                                        className={styles.slot}
                                        data-filled={code[i] ? '' : undefined}
                                        data-active={
                                            focused && (i === code.length || (complete && i === CODE_LENGTH - 1))
                                                ? ''
                                                : undefined
                                        }
                                    >
                                        {code[i] ?? ''}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <p id="display-code-error" className={styles.error} role="alert">
                            {error && (
                                <>
                                    <span className={styles.errorIcon} aria-hidden>
                                        {icons.error}
                                    </span>
                                    {error}
                                </>
                            )}
                        </p>
                    </div>

                    <div className={styles.nameField}>
                        <TextField
                            label="Name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            maxLength={LIMITS.displayName}
                            autoComplete="off"
                            enterKeyHint="go"
                            error={clash ? `Taken. Try ${freeName(name.trim(), taken)}.` : undefined}
                        />
                        <ChipSet label="Name suggestions">
                            {SUGGESTIONS.map((base) => {
                                const suggestion = freeName(base, taken)
                                return (
                                    <FilterChip
                                        key={base}
                                        selected={name === suggestion}
                                        onSelectedChange={() => setName(suggestion)}
                                    >
                                        {suggestion}
                                    </FilterChip>
                                )
                            })}
                        </ChipSet>
                    </div>

                    <Button
                        type="submit"
                        size="m"
                        className={styles.submit}
                        disabled={!complete || clash}
                        loading={pending}
                    >
                        Link display
                    </Button>
                </form>
            )}
        </div>
    )
}
