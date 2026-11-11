import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'
import { AssistChip, type AssistChipProps } from '@/components/ui/chip'
import { IconButton } from '@/components/ui/icon-button'
import { linkSemantics } from '@/components/ui/internal/link-semantics'

const link = createElement('a', { href: '/grocery' })
// children arrive as the third createElement argument.
const chipProps = { render: link, nativeButton: false } as unknown as AssistChipProps

describe('buttons rendered as links', () => {
    it('keep link semantics instead of role="button"', () => {
        const html = [
            renderToStaticMarkup(createElement(Button, { render: link, nativeButton: false }, 'Grocery')),
            renderToStaticMarkup(
                createElement(IconButton, { label: 'Grocery', icon: 'x', render: link, nativeButton: false }),
            ),
            renderToStaticMarkup(createElement(AssistChip, chipProps, 'Grocery')),
        ]
        for (const markup of html) {
            expect(markup).toMatch(/^<a [^>]*href="\/grocery"/)
            expect(markup).not.toContain('role="button"')
        }
    })

    it('still give non-link custom elements a button role', () => {
        const markup = renderToStaticMarkup(
            createElement(Button, { render: createElement('span'), nativeButton: false }, 'Go'),
        )
        expect(markup).toContain('role="button"')
    })
})

describe('linkSemantics', () => {
    // During SSR, a render element made in a Server Component arrives as a lazy wrapper
    // (react/react#32392), while the browser gets the plain element. Both must agree.
    const lazy = (element: unknown) => ({
        $$typeof: Symbol.for('react.lazy'),
        _payload: element,
        _init: (payload: unknown) => payload,
    })

    it('reads a lazy link the same as a plain one', () => {
        expect(linkSemantics(link, undefined)).toEqual({ role: undefined })
        expect(linkSemantics(lazy(link), undefined)).toEqual({ role: undefined })
        expect('role' in linkSemantics(lazy(link), undefined)).toBe(true)
    })

    it('leaves non-links alone', () => {
        expect(linkSemantics(createElement('span'), undefined)).toEqual({})
        expect(linkSemantics(lazy(createElement('span')), undefined)).toEqual({})
        expect(linkSemantics(undefined, undefined)).toEqual({})
    })
})
