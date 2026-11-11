import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'
import { AssistChip, type AssistChipProps } from '@/components/ui/chip'
import { IconButton } from '@/components/ui/icon-button'

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
