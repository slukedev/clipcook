import { readFileSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bookmarkletHref, bookmarkletSource } from '@/lib/domain/bookmarklet'
import { importRecipeFromBookmarklet, importRecipeFromUrl } from '@/server/autoimport'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/clip/${name}`, import.meta.url), 'utf8')

let server: http.Server
let base: string
let png: Buffer

beforeAll(async () => {
    png = await sharp({ create: { width: 200, height: 120, channels: 3, background: { r: 200, g: 60, b: 40 } } })
        .png()
        .toBuffer()
    server = http.createServer((req, res) => {
        const url = req.url ?? '/'
        if (url === '/recipe') {
            const html = fixture('microdata.html').replace('/photos/pancakes.jpg', '/photo.png')
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
            res.end(html)
        } else if (url === '/photo.png') {
            res.writeHead(200, { 'content-type': 'text/html' })
            res.end(png)
        } else if (url === '/fake.jpg') {
            res.writeHead(200, { 'content-type': 'image/jpeg' })
            res.end('<html>not an image</html>')
        } else if (url === '/plain') {
            res.writeHead(200, { 'content-type': 'application/pdf' })
            res.end('%PDF-1.4')
        } else if (url === '/about') {
            res.writeHead(200, { 'content-type': 'text/html' })
            res.end('<h1>About</h1>')
        } else {
            res.writeHead(404)
            res.end()
        }
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    base = `http://localhost:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
    server.close()
})

describe('importRecipeFromUrl', () => {
    it('clips a page and re-encodes its photo as WebP, sniffing bytes over the declared type', async () => {
        const r = await importRecipeFromUrl(`${base}/recipe`, { allowPrivate: true })
        expect(r.title).toBe('Fluffy Pancakes')
        expect(r.sourceName).toBe('Flip Daily')
        expect(r.sourceUrl).toBe(`${base}/recipe`)
        expect(r.image?.startsWith('data:image/webp;base64,')).toBe(true)
        expect(r).not.toHaveProperty('imageUrl')
        expect(r).not.toHaveProperty('method')
    })

    it('rejects non-HTML and pages with no recipe', async () => {
        await expect(importRecipeFromUrl(`${base}/plain`, { allowPrivate: true })).rejects.toMatchObject({
            code: 'NOT_HTML',
        })
        await expect(importRecipeFromUrl(`${base}/about`, { allowPrivate: true })).rejects.toMatchObject({
            code: 'NO_RECIPE',
        })
    })
})

describe('importRecipeFromBookmarklet', () => {
    it('parses posted JSON-LD without fetching the page and drops an image that is not one', async () => {
        const r = await importRecipeFromBookmarklet(
            {
                url: `${base}/somewhere`,
                title: 'Tab title',
                jsonld: [
                    JSON.stringify({
                        '@type': 'Recipe',
                        recipeIngredient: ['1 egg', '1 cup flour'],
                        recipeInstructions: ['Mix.'],
                        image: `${base}/fake.jpg`,
                    }),
                ],
                html: '<meta property="og:site_name" content="Posted Site">',
            },
            { allowPrivate: true },
        )
        expect(r.title).toBe('Tab title')
        expect(r.sourceName).toBe('Posted Site')
        expect(r.ingredients).toEqual(['1 egg', '1 cup flour'])
        expect(r.image).toBeUndefined()
    })

    it('never fetches private images without the test flag', async () => {
        const r = await importRecipeFromBookmarklet({
            url: 'https://example.com/r',
            jsonld: [
                JSON.stringify({
                    '@type': 'Recipe',
                    name: 'X',
                    recipeIngredient: ['a', 'b'],
                    image: `${base}/photo.png`,
                }),
            ],
        })
        expect(r.image).toBeUndefined()
    })

    it('rejects non-http page URLs', async () => {
        await expect(importRecipeFromBookmarklet({ url: 'javascript:alert(1)', jsonld: [] })).rejects.toMatchObject({
            code: 'INVALID_URL',
        })
    })
})

describe('bookmarklet', () => {
    it('is valid JavaScript with the origin baked in and survives URL encoding', () => {
        const src = bookmarkletSource('https://clipcook.example/')
        expect(() => new Function(src)).not.toThrow()
        expect(src).toContain('"https://clipcook.example"')
        const href = bookmarkletHref('https://clipcook.example')
        expect(href.startsWith('javascript:')).toBe(true)
        const decoded = decodeURIComponent(href.slice('javascript:'.length))
        expect(() => new Function(decoded)).not.toThrow()
        expect(decoded).not.toContain('\n')
    })

    it('escapes a hostile origin instead of injecting it', () => {
        const src = bookmarkletSource('https://x.example";alert(1);"')
        expect(src).toContain('"https://x.example\\";alert(1);\\""')
    })
})
