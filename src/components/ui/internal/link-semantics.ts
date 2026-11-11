import { isValidElement } from 'react'

/**
 * Base UI gives every non-native button `role="button"`, which hides a link's
 * semantics. When `render` is a link (anything with an `href`), the role is left
 * as the caller set it, so `<a href>` reads as a link.
 */
export function linkSemantics(render: unknown, role: string | undefined): { role?: string } {
    if (!isValidElement(render)) return {}
    const href = (render.props as { href?: unknown }).href
    return href === undefined || href === null ? {} : { role }
}
