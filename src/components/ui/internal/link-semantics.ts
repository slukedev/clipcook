import { Children, isValidElement } from 'react'

const REACT_LAZY_TYPE = Symbol.for('react.lazy')

/**
 * A render element created in a Server Component reaches a client component as a
 * lazy wrapper during SSR (react/react#32392) but as a plain element in the browser.
 * Unwrap it the way Base UI does, so the server and the client read the same props.
 */
function unwrap(render: unknown): unknown {
    if ((render as { $$typeof?: symbol } | null)?.$$typeof !== REACT_LAZY_TYPE) return render
    return Children.toArray(render as never)[0]
}

/**
 * Base UI gives every non-native button `role="button"`, which hides a link's
 * semantics. When `render` is a link (anything with an `href`), the role is left
 * as the caller set it, so `<a href>` reads as a link.
 */
export function linkSemantics(render: unknown, role: string | undefined): { role?: string } {
    const element = unwrap(render)
    if (!isValidElement(element)) return {}
    const href = (element.props as { href?: unknown }).href
    return href === undefined || href === null ? {} : { role }
}
