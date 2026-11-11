import { RouteLoading } from './_shell/route-loading'

/** Pages without a skeleton of their own get a neutral wait, never another page's layout. */
export default function Loading() {
    return <RouteLoading />
}
