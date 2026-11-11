import type { Metadata } from 'next'
import { claimClipDraft, clipFromText, clipFromUrl } from '@/actions/clip'
import { PageTransition } from '@/components/ui/view-transition'
import { requireSession } from '@/server/auth'
import { listRecipes } from '@/server/queries'
import { editorChoices } from '../_editor/data'
import { editorIcons } from '../_editor/icons'
import { ClipFlow } from './clip-flow'
import type { ClipJob, ClipResult } from './jobs'

export const metadata: Metadata = { title: 'Clip a Recipe' }

type Params = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string {
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

/**
 * Every way in: ?url= (share target, bookmarklet fallback, a pasted link),
 * ?text= (share target text, often a title plus a link), ?draft= (bookmarklet).
 */
function jobFrom(params: Params): ClipJob | null {
    const draft = first(params.draft)
    if (draft) return { kind: 'draft', value: draft }
    const url = first(params.url)
    const text = first(params.text)
    if (/^https?:\/\//i.test(url)) return { kind: 'url', value: url }
    if (text) return { kind: 'text', value: url ? `${text} ${url}` : text }
    if (url) return { kind: 'url', value: url }
    return null
}

function run(job: ClipJob): Promise<ClipResult> {
    const action = job.kind === 'url' ? clipFromUrl : job.kind === 'text' ? clipFromText : claimClipDraft
    return action(job.value).catch(() => ({
        ok: false as const,
        error: 'Could not clip that page. Try again.',
        code: 'network',
    }))
}

export default async function ClipPage({ searchParams }: { searchParams: Promise<Params> }) {
    const params = await searchParams
    const job = jobFrom(params)
    // Start clipping before anything else; the page streams its skeleton meanwhile.
    const result = job ? run(job) : null
    const session = await requireSession()
    const [recipes, choices] = await Promise.all([listRecipes(session.uid), editorChoices(session.uid)])
    const mode = first(params.mode) === 'text' ? 'text' : 'link'

    return (
        <PageTransition>
            <ClipFlow
                initial={job && result ? { job, result } : null}
                mode={mode}
                library={recipes.map((r) => ({ id: r.id, title: r.title, sourceUrl: r.sourceUrl }))}
                tags={choices.tags}
                collections={choices.collections}
                icons={editorIcons()}
            />
        </PageTransition>
    )
}
