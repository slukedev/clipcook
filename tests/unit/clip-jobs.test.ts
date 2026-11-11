import { describe, expect, it } from 'vitest'
import { classifyClipError, findDuplicate, normalizeSourceUrl } from '@/app/(app)/clip/jobs'
import { ClipError, type ClipErrorCode, clipFailureCode } from '@/server/clip/errors'

describe('normalizeSourceUrl', () => {
    it('ignores protocol, www, hash, tracking params, trailing slash and param order', () => {
        const a = normalizeSourceUrl('https://www.Example.com/recipes/soup/?b=2&utm_source=ig&a=1#comments')
        const b = normalizeSourceUrl('http://example.com/recipes/soup?a=1&b=2&UTM_medium=x')
        expect(a).toBe('example.com/recipes/soup?a=1&b=2')
        expect(b).toBe(a)
    })

    it('keeps paths and meaningful params apart', () => {
        expect(normalizeSourceUrl('https://example.com/soup')).not.toBe(normalizeSourceUrl('https://example.com/stew'))
        expect(normalizeSourceUrl('https://example.com/r?id=1')).not.toBe(
            normalizeSourceUrl('https://example.com/r?id=2'),
        )
        expect(normalizeSourceUrl('https://example.com/')).toBe('example.com')
    })

    it('returns null for something that is not a URL', () => {
        expect(normalizeSourceUrl('not a link')).toBeNull()
    })
})

describe('findDuplicate', () => {
    const library = [
        { id: 'a', title: 'Tomato Soup', sourceUrl: 'https://www.soups.example/tomato/' },
        { id: 'b', title: 'Shakshuka', sourceUrl: null },
        { id: 'c', title: 'Lentil Stew', sourceUrl: 'https://stews.example/lentil' },
    ]

    it('matches the same page even when the title changed', () => {
        const hit = findDuplicate(library, {
            title: 'Best Ever Tomato Soup',
            sourceUrl: 'https://soups.example/tomato?utm_campaign=x#top',
        })
        expect(hit?.id).toBe('a')
    })

    it('prefers the source over a title match on another recipe', () => {
        const hit = findDuplicate(library, { title: 'Shakshuka', sourceUrl: 'https://stews.example/lentil/' })
        expect(hit?.id).toBe('c')
    })

    it('falls back to the title, ignoring case and spacing', () => {
        expect(findDuplicate(library, { title: '  shakshuka ', sourceUrl: 'https://other.example/x' })?.id).toBe('b')
        expect(findDuplicate(library, { title: 'Lentil  stew' })?.id).toBe('c')
    })

    it('finds nothing for a new recipe or an empty title', () => {
        expect(findDuplicate(library, { title: 'Pancakes', sourceUrl: 'https://soups.example/pancakes' })).toBeNull()
        expect(findDuplicate(library, { title: '' })).toBeNull()
    })
})

describe('clip failure codes', () => {
    it('gives every server clip error a code the review flow understands', () => {
        const codes: ClipErrorCode[] = [
            'INVALID_URL',
            'BLOCKED_ADDRESS',
            'TIMEOUT',
            'TOO_LARGE',
            'NOT_HTML',
            'SITE_BLOCKED',
            'NOT_FOUND',
            'RATE_LIMITED',
            'UPSTREAM',
            'TOO_MANY_REDIRECTS',
            'NETWORK',
            'NO_RECIPE',
            'BAD_IMAGE',
        ]
        for (const code of codes) expect(clipFailureCode(new ClipError(code))).toMatch(/^[a-z_]+$/)
    })

    it('classifies codes into next steps', () => {
        expect(classifyClipError(clipFailureCode(new ClipError('SITE_BLOCKED')))).toBe('blocked')
        expect(classifyClipError(clipFailureCode(new ClipError('NO_RECIPE')))).toBe('no-recipe')
        expect(classifyClipError(clipFailureCode(new ClipError('NOT_FOUND')))).toBe('input')
        expect(classifyClipError(clipFailureCode(new ClipError('TIMEOUT')))).toBe('retry')
        expect(classifyClipError('unauthenticated')).toBe('session')
        expect(classifyClipError('draft_expired')).toBe('expired')
        expect(classifyClipError('invalid_url')).toBe('input')
        expect(classifyClipError(undefined)).toBe('retry')
        expect(classifyClipError('something_new')).toBe('retry')
        expect(classifyClipError('toString')).toBe('retry')
    })
})
