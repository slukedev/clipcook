import { PageTransition } from '@/components/ui/view-transition'
import { EditorSkeleton } from '../../../_editor/editor-skeleton'

function Placeholder() {
    return <EditorSkeleton heading="Edit Recipe" />
}

/** Enters with the navigation's motion and crossfades into the page when it arrives. */
export default function Loading() {
    return (
        <PageTransition>
            <Placeholder />
        </PageTransition>
    )
}
