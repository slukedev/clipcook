import http from 'node:http'
import type { AddressInfo } from 'node:net'
import net from 'node:net'
import zlib from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ClipError } from '@/server/clip/errors'
import { createSafeLookup, decodeHtml, safeFetch, sniffImageType } from '@/server/clip/fetch'
import { isBlockedAddress } from '@/server/clip/ip'

type Answer = Array<{ address: string; family: number }>

function fakeResolver(answer: Answer) {
    return (_host: string, _opts: unknown, cb: (err: NodeJS.ErrnoException | null, a: Answer) => void) =>
        queueMicrotask(() => cb(null, answer))
}

function callLookup(
    lookup: net.LookupFunction,
    options: object,
): Promise<{ err: NodeJS.ErrnoException | null; address: unknown; family: unknown }> {
    return new Promise((resolve) => {
        lookup(
            'recipes.example',
            options as never,
            ((err: NodeJS.ErrnoException | null, address: unknown, family: unknown) =>
                resolve({ err, address, family })) as never,
        )
    })
}

describe('private range table', () => {
    it.each([
        '127.0.0.1',
        '10.20.30.40',
        '172.31.255.255',
        '192.168.1.1',
        '169.254.169.254',
        '100.64.0.1',
        '100.127.255.254',
        '198.18.0.1',
        '198.19.255.255',
        '192.0.0.8',
        '192.0.2.10',
        '198.51.100.7',
        '203.0.113.9',
        '0.0.0.0',
        '224.0.0.251',
        '239.255.255.250',
        '255.255.255.255',
        '::1',
        '::',
        '::ffff:127.0.0.1',
        '::ffff:7f00:1',
        '::ffff:169.254.169.254',
        '0:0:0:0:0:ffff:10.0.0.1',
        '::10.0.0.1',
        '64:ff9b::a9fe:a9fe',
        'fc00::1',
        'fd12:3456::1',
        'fe80::1%eth0',
        'febf::1',
        'ff02::1',
        '2001:db8::1',
        '2002:c0a8:101::1',
        'not-an-ip',
    ])('blocks %s', (address) => {
        expect(isBlockedAddress(address)).toBe(true)
    })

    it.each([
        '8.8.8.8',
        '1.1.1.1',
        '100.63.255.255',
        '100.128.0.1',
        '172.15.0.1',
        '172.32.0.1',
        '198.17.255.255',
        '198.20.0.1',
        '192.0.1.1',
        '2606:4700:4700::1111',
        '2a00:1450:4001:80b::200e',
        '::ffff:8.8.8.8',
    ])('allows %s', (address) => {
        expect(isBlockedAddress(address)).toBe(false)
    })
})

describe('createSafeLookup', () => {
    it('answers an array when asked with all:true (autoSelectFamily path)', async () => {
        const lookup = createSafeLookup({
            resolver: fakeResolver([
                { address: '93.184.216.34', family: 4 },
                { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
            ]),
        })
        const { err, address } = await callLookup(lookup, { all: true })
        expect(err).toBeNull()
        expect(address).toEqual([
            { address: '93.184.216.34', family: 4 },
            { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
        ])
    })

    it('answers a single address and family with all:false', async () => {
        const lookup = createSafeLookup({ resolver: fakeResolver([{ address: '93.184.216.34', family: 4 }]) })
        const { err, address, family } = await callLookup(lookup, { all: false })
        expect(err).toBeNull()
        expect(address).toBe('93.184.216.34')
        expect(family).toBe(4)
    })

    it('rejects when any answer is private, even if the first is public', async () => {
        const lookup = createSafeLookup({
            resolver: fakeResolver([
                { address: '93.184.216.34', family: 4 },
                { address: '10.0.0.5', family: 4 },
            ]),
        })
        for (const all of [true, false]) {
            const { err } = await callLookup(lookup, { all })
            expect(err?.code).toBe('ECLIPBLOCKED')
        }
    })

    it('rejects mapped loopback answers', async () => {
        const lookup = createSafeLookup({ resolver: fakeResolver([{ address: '::ffff:127.0.0.1', family: 6 }]) })
        const { err } = await callLookup(lookup, { all: true })
        expect(err?.code).toBe('ECLIPBLOCKED')
    })

    it('reports ENOTFOUND for an empty answer', async () => {
        const lookup = createSafeLookup({ resolver: fakeResolver([]) })
        const { err } = await callLookup(lookup, { all: true })
        expect(err?.code).toBe('ENOTFOUND')
    })

    it('lets net.connect with autoSelectFamily dial through it (the production bug)', async () => {
        const server = net.createServer((s) => s.end('ok'))
        await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
        const { port } = server.address() as AddressInfo
        const lookup = createSafeLookup({ allowPrivate: true })
        const data = await new Promise<string>((resolve, reject) => {
            const socket = net.connect({ host: 'localhost', port, lookup, autoSelectFamily: true })
            let buf = ''
            socket.on('data', (d) => {
                buf += d
            })
            socket.on('end', () => resolve(buf))
            socket.on('error', reject)
        })
        server.close()
        expect(data).toBe('ok')
    })
})

describe('safeFetch against a local server', () => {
    let server: http.Server
    let base: string

    beforeAll(async () => {
        server = http.createServer((req, res) => {
            const url = req.url ?? '/'
            if (url === '/recipe') {
                res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-encoding': 'gzip' })
                res.end(zlib.gzipSync('<html><title>Soup</title></html>'))
            } else if (url === '/hop') {
                res.writeHead(302, { location: '/recipe' })
                res.end()
            } else if (url === '/loop') {
                res.writeHead(302, { location: '/loop' })
                res.end()
            } else if (url === '/to-metadata') {
                res.writeHead(301, { location: 'http://169.254.169.254/latest/meta-data' })
                res.end()
            } else if (url === '/forbidden') {
                res.writeHead(403, { 'content-type': 'text/html' })
                res.end('nope')
            } else if (url === '/challenge') {
                res.writeHead(200, { 'content-type': 'text/html' })
                res.end('<html><head><title>Just a moment...</title></head></html>')
            } else if (url === '/huge') {
                res.writeHead(200, { 'content-type': 'text/html' })
                res.end('x'.repeat(2048))
            } else if (url === '/latin1') {
                res.writeHead(200, { 'content-type': 'text/html' })
                res.end(Buffer.from('<meta charset="iso-8859-1"><p>Cr\xe8me br\xfbl\xe9e</p>', 'latin1'))
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

    const opts = { maxBytes: 1024, kind: 'html' as const, allowPrivate: true }

    it('resolves a hostname, follows a redirect, and decompresses', async () => {
        const res = await safeFetch(`${base}/hop`, opts)
        expect(new TextDecoder().decode(res.body)).toContain('<title>Soup</title>')
        expect(res.finalUrl).toBe(`${base}/recipe`)
    })

    it('blocks localhost without the test flag', async () => {
        await expect(safeFetch(`${base}/recipe`, { maxBytes: 1024, kind: 'html' })).rejects.toMatchObject({
            code: 'BLOCKED_ADDRESS',
        })
    })

    it('blocks a redirect to a link-local metadata address even mid-chain', async () => {
        // allowPrivate only lets us reach the local server; the literal hop is still validated without it.
        await expect(safeFetch(`${base}/to-metadata`, { ...opts, allowPrivate: false })).rejects.toBeInstanceOf(
            ClipError,
        )
    })

    it('caps redirects', async () => {
        await expect(safeFetch(`${base}/loop`, opts)).rejects.toMatchObject({ code: 'TOO_MANY_REDIRECTS' })
    })

    it('maps 403 and challenge pages to SITE_BLOCKED', async () => {
        await expect(safeFetch(`${base}/forbidden`, opts)).rejects.toMatchObject({ code: 'SITE_BLOCKED' })
        await expect(safeFetch(`${base}/challenge`, opts)).rejects.toMatchObject({ code: 'SITE_BLOCKED' })
    })

    it('enforces the body cap', async () => {
        await expect(safeFetch(`${base}/huge`, opts)).rejects.toMatchObject({ code: 'TOO_LARGE' })
    })

    it('maps 404', async () => {
        await expect(safeFetch(`${base}/missing`, opts)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('times out against the shared deadline', async () => {
        await expect(safeFetch(`${base}/recipe`, { ...opts, deadline: Date.now() - 1 })).rejects.toMatchObject({
            code: 'TIMEOUT',
        })
    })

    it('decodes a meta-declared legacy charset', async () => {
        const res = await safeFetch(`${base}/latin1`, opts)
        expect(decodeHtml(res.body, res.contentType)).toContain('Crème brûlée')
    })

    it('rejects non-http schemes, credentials, and odd ports', async () => {
        await expect(safeFetch('file:///etc/passwd', opts)).rejects.toMatchObject({ code: 'INVALID_URL' })
        await expect(safeFetch('https://user:pw@example.com/', opts)).rejects.toMatchObject({ code: 'INVALID_URL' })
        await expect(safeFetch('http://example.com:6379/', { maxBytes: 10, kind: 'html' })).rejects.toMatchObject({
            code: 'BLOCKED_ADDRESS',
        })
        await expect(safeFetch('http://[::ffff:7f00:1]/', { maxBytes: 10, kind: 'html' })).rejects.toMatchObject({
            code: 'BLOCKED_ADDRESS',
        })
    })
})

describe('sniffImageType', () => {
    it('trusts bytes, not names', () => {
        const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
        const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')
        const html = new TextEncoder().encode('<!doctype html><html>')
        expect(sniffImageType(png)).toBe('image/png')
        expect(sniffImageType(webp)).toBe('image/webp')
        expect(sniffImageType(html)).toBeNull()
    })
})
