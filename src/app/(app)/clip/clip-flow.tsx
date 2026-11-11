'use client'

import Link from 'next/link'
import {
    type ClipboardEvent,
    type FormEvent,
    type ReactNode,
    Suspense,
    use,
    useEffect,
    useId,
    useRef,
    useState,
} from 'react'
import { claimClipDraft, clipFromText, clipFromUrl } from '@/actions/clip'
import { Button } from '@/components/ui/button'
import { ConnectedButtonGroup, ConnectedButtonGroupItem } from '@/components/ui/button-group'
import { AssistChip } from '@/components/ui/chip'
import { IconButton } from '@/components/ui/icon-button'
import { LoadingIndicator } from '@/components/ui/loading-indicator'
import { Shape } from '@/components/ui/shape'
import { Skeleton } from '@/components/ui/skeleton'
import { TextField } from '@/components/ui/text-field'
import { TopAppBar } from '@/components/ui/top-app-bar'
import { useViewTransitionRouter } from '@/components/ui/view-transition'
import type { ImportedRecipe } from '@/lib/domain/types'
import { parseRecipeText } from '@/lib/recipe/text-import'
import type { EditorIcons } from '../_editor/icons'
import { previousPath } from '../_editor/navigation'
import { RecipeEditor } from '../_editor/recipe-editor'
import {
    type EditorCollection,
    type EditorPhoto,
    type EditorValues,
    emptyValues,
    hostOf,
    isLowConfidence,
    valuesFromImported,
} from '../_editor/values'
import styles from './clip.module.scss'
import { ClipReview } from './clip-review'
import {
    type ClipFailure,
    type ClipJob,
    type ClipResult,
    classifyClipError,
    findUrl,
    isLoneUrl,
    type LibraryEntry,
    offlineAwareError,
} from './jobs'

interface Attempt {
    key: number
    job: ClipJob
    result: Promise<ClipResult>
}

type View =
    | {
          type: 'entry'
          mode: 'link' | 'text'
          url: string
          text: string
          failure?: { job: ClipJob; message: string; code?: string }
      }
    | { type: 'attempt'; attempt: Attempt }
    | { type: 'manual'; values: EditorValues; photo: EditorPhoto }

export interface ClipFlowProps {
    initial: { job: ClipJob; result: Promise<ClipResult> } | null
    mode: 'link' | 'text'
    library: LibraryEntry[]
    tags: string[]
    collections: EditorCollection[]
    icons: EditorIcons
}

const TEXT_DRAFT_KEY = 'clipcook.clip.text'

function readTextDraft(): string {
    try {
        return sessionStorage.getItem(TEXT_DRAFT_KEY) ?? ''
    } catch {
        return ''
    }
}

function writeTextDraft(text: string) {
    try {
        if (text) sessionStorage.setItem(TEXT_DRAFT_KEY, text)
        else sessionStorage.removeItem(TEXT_DRAFT_KEY)
    } catch {
        // Private windows can refuse storage; the draft is a convenience.
    }
}

function runJob(job: ClipJob): Promise<ClipResult> {
    const action = job.kind === 'url' ? clipFromUrl : job.kind === 'text' ? clipFromText : claimClipDraft
    return action(job.value).catch(offlineAwareError)
}

function setAddress(query: string) {
    window.history.replaceState(null, '', `/clip${query}`)
}

/** The clip flow: paste or share something in, review what was found, save. */
export function ClipFlow({ initial, mode, library, tags, collections, icons }: ClipFlowProps) {
    const router = useViewTransitionRouter()
    const [view, setView] = useState<View>(() =>
        initial
            ? { type: 'attempt', attempt: { key: 0, job: initial.job, result: initial.result } }
            : { type: 'entry', mode, url: '', text: '' },
    )

    function start(job: ClipJob) {
        if (job.kind === 'text') writeTextDraft(job.value)
        setView({ type: 'attempt', attempt: { key: Date.now(), job, result: runJob(job) } })
        setAddress(
            job.kind === 'url' ? `?url=${encodeURIComponent(job.value)}` : job.kind === 'text' ? '?mode=text' : '',
        )
    }

    function toEntry(next: Omit<Extract<View, { type: 'entry' }>, 'type'>) {
        setView({ type: 'entry', ...next })
        setAddress(next.failure ? window.location.search : `?mode=${next.mode}`)
    }

    function exit() {
        if (previousPath()) router.back()
        else router.replace('/', 'back')
    }

    function writeIt(job: ClipJob) {
        let values = emptyValues()
        if (job.kind === 'url') {
            values = { ...values, sourceUrl: job.value, sourceName: hostOf(job.value) }
        } else if (job.kind === 'text') {
            // Keep what the parser understood, and the rest as notes to sort out.
            values = { ...valuesFromImported(parseRecipeText(job.value)), notes: job.value }
        }
        setView({ type: 'manual', values, photo: { kind: 'none' } })
    }

    if (view.type === 'manual') {
        return (
            <RecipeEditor
                heading="New recipe"
                initial={view.values}
                initialPhoto={view.photo}
                tags={tags}
                collections={collections}
                icons={icons}
                closeHref="/clip"
                onClose={() => toEntry({ mode: 'link', url: view.values.sourceUrl, text: '' })}
                startDirty
            />
        )
    }

    if (view.type === 'attempt') {
        const { attempt } = view
        return (
            <Suspense
                key={attempt.key}
                fallback={
                    <Pending
                        job={attempt.job}
                        icons={icons}
                        onExit={exit}
                        onRestart={(url) => start({ kind: 'url', value: url })}
                    />
                }
            >
                <Outcome
                    attempt={attempt}
                    library={library}
                    tags={tags}
                    collections={collections}
                    icons={icons}
                    onExit={exit}
                    onFailure={(message, code) =>
                        toEntry({
                            mode: attempt.job.kind === 'text' ? 'text' : 'link',
                            url: attempt.job.kind === 'url' ? attempt.job.value : '',
                            text: attempt.job.kind === 'text' ? attempt.job.value : '',
                            failure: { job: attempt.job, message, code },
                        })
                    }
                />
            </Suspense>
        )
    }

    return (
        <Entry
            key={view.failure ? `f${view.failure.message}` : view.mode}
            view={view}
            icons={icons}
            onExit={exit}
            onStart={start}
            onRetry={() => view.failure && start(view.failure.job)}
            onWrite={() => (view.failure ? writeIt(view.failure.job) : router.push('/new'))}
            onMode={(mode, carry) =>
                toEntry({ mode, url: mode === 'link' ? carry : '', text: mode === 'text' ? carry : '' })
            }
        />
    )
}

/* Outcome: resolves the attempt into a review, the editor, or back to the entry. */

function Outcome({
    attempt,
    library,
    tags,
    collections,
    icons,
    onExit,
    onFailure,
}: {
    attempt: Attempt
    library: LibraryEntry[]
    tags: string[]
    collections: EditorCollection[]
    icons: EditorIcons
    onExit: () => void
    onFailure: (message: string, code?: string) => void
}) {
    const result = use(attempt.result)
    useEffect(() => {
        if (!result.ok) onFailure(result.error, result.code)
    })
    if (!result.ok) return <Pending job={attempt.job} icons={icons} onExit={onExit} onRestart={() => {}} />
    return (
        <Found
            recipe={result.data}
            library={library}
            tags={tags}
            collections={collections}
            icons={icons}
            onExit={onExit}
        />
    )
}

function Found({
    recipe,
    library,
    tags,
    collections,
    icons,
    onExit,
}: {
    recipe: ImportedRecipe
    library: LibraryEntry[]
    tags: string[]
    collections: EditorCollection[]
    icons: EditorIcons
    onExit: () => void
}) {
    // Thin results go straight to the editor with what was found filled in.
    const [editing, setEditing] = useState(() => isLowConfidence(recipe))
    const photo: EditorPhoto = recipe.image ? { kind: 'clipped', src: recipe.image } : { kind: 'none' }
    if (editing) {
        return (
            <RecipeEditor
                heading="New recipe"
                initial={valuesFromImported(recipe)}
                initialPhoto={photo}
                tags={tags}
                collections={collections}
                icons={icons}
                closeHref="/clip"
                onClose={() => setEditing(false)}
                startDirty
            />
        )
    }
    return (
        <ClipReview recipe={recipe} library={library} icons={icons} onEdit={() => setEditing(true)} onExit={onExit} />
    )
}

/* Pending: the review's skeleton, with the link still editable. */

function Pending({
    job,
    icons,
    onExit,
    onRestart,
}: {
    job: ClipJob
    icons: EditorIcons
    onExit: () => void
    onRestart: (url: string) => void
}) {
    const host = job.kind === 'url' ? hostOf(job.value) : ''
    const [url, setUrl] = useState(job.kind === 'url' ? job.value : '')

    function submit(event: FormEvent) {
        event.preventDefault()
        const next = url.trim()
        if (next && next !== (job.kind === 'url' ? job.value : '')) onRestart(next)
    }

    return (
        <div className={styles.page}>
            <TopAppBar
                title="Clip a recipe"
                leading={<IconButton label="Close" icon={icons.close} onClick={onExit} />}
            />
            <div className={styles.pending} aria-busy="true">
                {job.kind === 'url' && (
                    <form className={styles.pendingForm} onSubmit={submit}>
                        <TextField
                            label="Link"
                            variant="outlined"
                            type="url"
                            inputMode="url"
                            enterKeyHint="go"
                            value={url}
                            leadingIcon={icons.link}
                            onChange={(e) => setUrl(e.currentTarget.value)}
                        />
                    </form>
                )}
                <div className={styles.preview}>
                    <div className={styles.previewMain}>
                        <div className={styles.previewPhoto}>
                            <div className={styles.previewStatus} role="status">
                                <LoadingIndicator
                                    contained
                                    size={64}
                                    label={host ? `Clipping ${host}` : 'Finding the recipe'}
                                />
                                {host && <span className={styles.previewHost}>{host}</span>}
                            </div>
                        </div>
                        <Skeleton shape="text" className={styles.skTitle} width="80%" />
                        <Skeleton shape="text" width="40%" />
                        <div className={styles.skFacts}>
                            <Skeleton shape="small" width={96} height={32} />
                            <Skeleton shape="small" width={96} height={32} />
                            <Skeleton shape="small" width={96} height={32} />
                        </div>
                        <Skeleton lines={3} />
                    </div>
                    <div className={styles.previewSide}>
                        <Skeleton shape="text" className={styles.skHeading} width={140} />
                        {['a', 'b', 'c', 'd', 'e'].map((k) => (
                            <Skeleton key={k} shape="medium" height={48} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

/* Entry: a link or pasted text, plus what to do after a failure. */

const FAILURE_ICON: Record<ClipFailure, keyof EditorIcons> = {
    blocked: 'blocked',
    'no-recipe': 'searchOff',
    retry: 'offline',
    input: 'error',
    session: 'error',
    expired: 'error',
}

function Entry({
    view,
    icons,
    onExit,
    onStart,
    onRetry,
    onWrite,
    onMode,
}: {
    view: Extract<View, { type: 'entry' }>
    icons: EditorIcons
    onExit: () => void
    onStart: (job: ClipJob) => void
    onRetry: () => void
    onWrite: () => void
    onMode: (mode: 'link' | 'text', carry: string) => void
}) {
    const { mode, failure } = view
    const errorId = useId()
    const [url, setUrl] = useState(view.url)
    const [text, setText] = useState(() => view.text)
    const [fieldError, setFieldError] = useState<string | undefined>()
    const [suggestion, setSuggestion] = useState<string | null>(null)
    const [canPaste, setCanPaste] = useState(false)
    const formRef = useRef<HTMLFormElement>(null)
    const kind = failure ? classifyClipError(failure.code) : null

    useEffect(() => {
        setCanPaste(typeof navigator.clipboard?.readText === 'function')
        if (mode === 'text' && !view.text) {
            const draft = readTextDraft()
            if (draft) setText(draft)
        }
    }, [mode, view.text])

    useEffect(() => {
        if (mode === 'text') writeTextDraft(text)
    }, [mode, text])

    // A link already on the clipboard becomes a one-tap suggestion, but only when the
    // browser already allows reading it, and only after the cook touches the page.
    useEffect(() => {
        if (mode !== 'link' || failure) return
        let done = false
        async function peek() {
            if (done) return
            done = true
            try {
                const state = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName })
                if (state.state !== 'granted') return
                const clip = await navigator.clipboard.readText()
                const found = isLoneUrl(clip) ? findUrl(clip) : null
                if (found) setSuggestion(found)
            } catch {
                // No permission API or no clipboard access: the Paste button still works.
            }
        }
        window.addEventListener('pointerdown', peek, { once: true })
        window.addEventListener('keydown', peek, { once: true })
        return () => {
            window.removeEventListener('pointerdown', peek)
            window.removeEventListener('keydown', peek)
        }
    }, [mode, failure])

    function submitLink(value: string) {
        const link = findUrl(value.trim()) ?? value.trim()
        if (!link) {
            setFieldError('Paste a link first.')
            return
        }
        if (!/^https?:\/\//i.test(link)) {
            if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(link)) {
                onStart({ kind: 'url', value: `https://${link}` })
                return
            }
            setFieldError('Enter a full web address.')
            return
        }
        onStart({ kind: 'url', value: link })
    }

    function submitText(value: string) {
        if (!value.trim()) {
            setFieldError('Paste a recipe first.')
            return
        }
        onStart({ kind: 'text', value })
    }

    function onSubmit(event: FormEvent) {
        event.preventDefault()
        if (mode === 'link') submitLink(url)
        else submitText(text)
    }

    async function paste() {
        let clip = ''
        try {
            clip = await navigator.clipboard.readText()
        } catch {
            setFieldError('Paste with your keyboard or long-press the field.')
            return
        }
        if (!clip.trim()) {
            setFieldError('The clipboard is empty.')
            return
        }
        if (mode === 'link') {
            if (isLoneUrl(clip)) {
                const found = findUrl(clip) ?? clip.trim()
                setUrl(found)
                onStart({ kind: 'url', value: found })
            } else if (clip.trim().split('\n').length > 2) {
                onMode('text', clip)
            } else {
                setUrl(clip.trim())
            }
        } else {
            setText(clip)
            setFieldError(undefined)
        }
    }

    function onLinkPaste(event: ClipboardEvent<HTMLInputElement>) {
        const clip = event.clipboardData.getData('text/plain')
        if (url.trim() || !isLoneUrl(clip)) return
        event.preventDefault()
        const found = findUrl(clip) ?? clip.trim()
        setUrl(found)
        onStart({ kind: 'url', value: found })
    }

    let actions: ReactNode = null
    if (kind === 'blocked') {
        actions = (
            <>
                <Button
                    variant="tonal"
                    icon={icons.bookmark}
                    render={<Link href="/settings#clipping" />}
                    nativeButton={false}
                >
                    Use the bookmarklet
                </Button>
                <Button variant="outlined" icon={icons.text} onClick={() => onMode('text', '')}>
                    Paste text instead
                </Button>
            </>
        )
    } else if (kind === 'no-recipe') {
        actions = (
            <>
                {mode === 'link' && (
                    <Button variant="tonal" icon={icons.text} onClick={() => onMode('text', '')}>
                        Paste text instead
                    </Button>
                )}
                <Button variant="outlined" icon={icons.write} onClick={onWrite}>
                    Write it yourself
                </Button>
            </>
        )
    } else if (kind === 'retry') {
        actions = (
            <>
                <Button variant="tonal" icon={icons.refresh} onClick={onRetry}>
                    Retry
                </Button>
                {mode === 'link' && (
                    <Button variant="outlined" icon={icons.text} onClick={() => onMode('text', '')}>
                        Paste text instead
                    </Button>
                )}
            </>
        )
    } else if (kind === 'session') {
        actions = (
            <Button variant="tonal" render={<a href="/login?next=%2Fclip" />} nativeButton={false}>
                Sign in
            </Button>
        )
    } else if (kind === 'expired' || kind === 'input') {
        actions =
            mode === 'link' ? (
                <Button variant="outlined" icon={icons.text} onClick={() => onMode('text', '')}>
                    Paste text instead
                </Button>
            ) : null
    }

    const error = fieldError ?? (kind === 'input' ? failure?.message : undefined)
    const banner = failure && kind !== 'input' ? failure.message : null

    return (
        <div className={styles.page}>
            <TopAppBar
                title="Clip a recipe"
                leading={<IconButton label="Close" icon={icons.close} onClick={onExit} />}
            />
            <form ref={formRef} className={styles.entry} onSubmit={onSubmit} noValidate data-mode={mode}>
                <div className={styles.hero} aria-hidden>
                    <Shape name={mode === 'link' ? 'cookie9' : 'clover4'} size={88} className={styles.heroShape} />
                    <span className={styles.heroIcon}>{mode === 'link' ? icons.addLink : icons.text}</span>
                </div>

                <ConnectedButtonGroup
                    label="Clip from"
                    variant="filled"
                    className={styles.modes}
                    value={[mode]}
                    onValueChange={(v) => {
                        const next = v[0] as 'link' | 'text' | undefined
                        if (next && next !== mode) onMode(next, '')
                    }}
                >
                    <ConnectedButtonGroupItem value="link" icon={icons.link}>
                        Link
                    </ConnectedButtonGroupItem>
                    <ConnectedButtonGroupItem value="text" icon={icons.text}>
                        Text
                    </ConnectedButtonGroupItem>
                </ConnectedButtonGroup>

                {banner && (
                    <div className={styles.failure} role="alert" id={errorId}>
                        <span className={styles.failureIcon}>{icons[FAILURE_ICON[kind ?? 'retry']]}</span>
                        <p className={styles.failureText}>{banner}</p>
                    </div>
                )}

                {mode === 'link' ? (
                    <TextField
                        label="Link"
                        variant="outlined"
                        type="url"
                        inputMode="url"
                        autoComplete="url"
                        enterKeyHint="go"
                        autoFocus={!failure}
                        value={url}
                        error={error}
                        leadingIcon={icons.link}
                        trailingIcon={
                            canPaste ? (
                                <IconButton label="Paste" icon={icons.paste} onClick={() => void paste()} />
                            ) : undefined
                        }
                        onChange={(e) => {
                            setUrl(e.currentTarget.value)
                            setFieldError(undefined)
                        }}
                        onPaste={onLinkPaste}
                    />
                ) : (
                    <TextField
                        label="Recipe text"
                        variant="outlined"
                        multiline
                        rows={8}
                        maxRows={18}
                        maxLength={100_000}
                        autoFocus={!failure}
                        value={text}
                        error={error}
                        onChange={(e) => {
                            setText(e.currentTarget.value)
                            setFieldError(undefined)
                        }}
                    />
                )}

                {suggestion && !url && mode === 'link' && (
                    <div className={styles.suggestion}>
                        <AssistChip
                            icon={icons.paste}
                            onClick={() => {
                                setUrl(suggestion)
                                onStart({ kind: 'url', value: suggestion })
                            }}
                        >
                            {`Paste ${hostOf(suggestion) || 'link'}`}
                        </AssistChip>
                    </div>
                )}

                <div className={styles.actions}>
                    <Button type="submit" size="m" icon={mode === 'link' ? icons.addLink : undefined}>
                        {mode === 'link' ? 'Clip' : 'Find recipe'}
                    </Button>
                    {mode === 'text' && canPaste && !text && (
                        <Button variant="tonal" size="m" icon={icons.paste} onClick={() => void paste()}>
                            Paste
                        </Button>
                    )}
                </div>

                {actions && <div className={styles.next}>{actions}</div>}

                {!failure && (
                    <div className={styles.manual}>
                        <Button variant="text" icon={icons.write} onClick={onWrite}>
                            Write it yourself
                        </Button>
                    </div>
                )}
            </form>
        </div>
    )
}
