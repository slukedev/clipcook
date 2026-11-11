import { PageTransition } from '@/components/ui/view-transition'
import { RouteLoading } from './_shell/route-loading'

/** Pages without a skeleton of their own get a neutral wait, never another page's layout. */
function Placeholder() {
    return <RouteLoading />
}

/** Enters with the navigation's motion and crossfades into the page when it arrives. */
export default function Loading() {
    return (
        <PageTransition>
            <Placeholder />
        </PageTransition>
    )
}
