import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { safeNextPath } from '@/lib/domain/safe-path'
import { EXPORT_SCHEMA } from '@/lib/domain/types'
import { endsSession } from '@/lib/sw-signals'
import { isBlockedAddress } from '@/server/clip/ip'
import { parseExport } from '@/server/data-transfer'

describe('safeNextPath (sign-in continuation)', () => {
    it('keeps same-origin paths with their query and hash', () => {
        expect(safeNextPath('/recipe/abc')).toBe('/recipe/abc')
        expect(safeNextPath('/clip?url=https%3A%2F%2Fsite.example%2Fr&mode=link')).toBe(
            '/clip?url=https%3A%2F%2Fsite.example%2Fr&mode=link',
        )
        expect(safeNextPath('/link?code=ABC234#x')).toBe('/link?code=ABC234#x')
    })

    it('rejects anything a browser would resolve to another host', () => {
        for (const next of [
            '//evil.example',
            '/\\evil.example',
            '/\t/evil.example/pwned',
            '/\n/evil.example',
            '/\r\n/evil.example',
            '/\t\\evil.example',
            '\\\\evil.example',
            'https://evil.example',
            'javascript:alert(1)',
            '',
        ]) {
            expect(safeNextPath(next), JSON.stringify(next)).toBe('/')
        }
    })

    it('never loops back to sign-in and ignores non-strings and huge values', () => {
        expect(safeNextPath('/login')).toBe('/')
        expect(safeNextPath('/login?next=/x')).toBe('/')
        expect(safeNextPath(undefined)).toBe('/')
        expect(safeNextPath(['/recipe/a'])).toBe('/')
        expect(safeNextPath(`/clip?text=${'a'.repeat(9000)}`)).toBe('/')
    })
})

describe('service worker sign-out signal', () => {
    const h = (value: string | null) => new Headers(value === null ? {} : { 'x-action-redirect': value })
    it('recognises the sign-out action redirect', () => {
        expect(endsSession(h('/login;replace'))).toBe(true)
        expect(endsSession(h('/login;push'))).toBe(true)
        expect(endsSession(h('/api/auth/signout;replace'))).toBe(true)
    })
    it('ignores other redirects and plain responses', () => {
        expect(endsSession(h('/;replace'))).toBe(false)
        expect(endsSession(h('/recipe/abc;push'))).toBe(false)
        expect(endsSession(h('/loginx;push'))).toBe(false)
        expect(endsSession(h(null))).toBe(false)
    })
})

describe('import file validation', () => {
    it('drops source links that are not http(s)', () => {
        const file = parseExport(
            JSON.stringify({
                schema: EXPORT_SCHEMA,
                recipes: [
                    { title: 'A', sourceUrl: 'javascript:alert(document.cookie)' },
                    { title: 'B', sourceUrl: 'data:text/html,<script>alert(1)</script>' },
                    { title: 'C', sourceUrl: 'https://site.example/c' },
                ],
            }),
        )
        expect(file.recipes.map((r) => r.sourceUrl)).toEqual([null, null, 'https://site.example/c'])
    })
})

describe('SSRF address table', () => {
    it('blocks IPv4-translated IPv6 addresses (::ffff:0:a.b.c.d)', () => {
        expect(isBlockedAddress('::ffff:0:7f00:1')).toBe(true)
        expect(isBlockedAddress('::ffff:0:127.0.0.1')).toBe(true)
        expect(isBlockedAddress('::ffff:0:a9fe:a9fe')).toBe(true)
        // Ordinary public IPv6 stays reachable.
        expect(isBlockedAddress('2606:4700:4700::1111')).toBe(false)
    })
})

describe('route hardening', () => {
    let dir: string
    beforeAll(async () => {
        dir = await mkdtemp(path.join(os.tmpdir(), 'clipcook-security-'))
        process.env.CLIPCOOK_BACKEND = 'local'
        process.env.CLIPCOOK_DATA_DIR = dir
    })
    afterAll(async () => {
        await rm(dir, { recursive: true, force: true })
    })

    it('the bookmarklet script is never stored by shared caches', async () => {
        const { GET } = await import('@/app/api/clip/bookmarklet/route')
        const res = GET(new NextRequest('https://clipcook.test/api/clip/bookmarklet'))
        expect(res.headers.get('cache-control')).toMatch(/^private/)
    })

    it('the image route answers 404 for malformed recipe ids before any lookup', async () => {
        const { GET } = await import('@/app/api/images/[id]/[kind]/route')
        const res = await GET(new NextRequest('https://clipcook.test/api/images/x/photo'), {
            params: Promise.resolve({ id: 'allRecipes/../x', kind: 'photo' }),
        })
        expect(res.status).toBe(404)
    })
})
