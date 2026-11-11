import dns, { type LookupAddress, type LookupAllOptions } from 'node:dns'
import net from 'node:net'
import { Agent, type Dispatcher, fetch as undiciFetch } from 'undici'
import { ClipError } from './errors'
import { isBlockedAddress } from './ip'

export const MAX_HTML_BYTES = 3 * 1024 * 1024
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const FETCH_BUDGET_MS = 15_000
const MAX_REDIRECTS = 5

const BROWSER_HEADERS: Record<string, string> = {
    'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Sec-CH-UA': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"macOS"',
}

const HTML_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
const IMAGE_ACCEPT = 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8'

type Resolver = (
    hostname: string,
    options: LookupAllOptions,
    callback: (err: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
) => void

const defaultResolver: Resolver = (hostname, options, callback) => dns.lookup(hostname, options, callback)

export interface SafeLookupOptions {
    /** Tests only: lets the lookup return loopback so a local server can stand in for the web. */
    allowPrivate?: boolean
    resolver?: Resolver
}

/**
 * A `net` lookup that refuses private and reserved destinations.
 *
 * Node 20+ dials with autoSelectFamily, which calls lookup with `{ all: true }` and
 * expects an array back; answering with a single address breaks every connection.
 * We always resolve the full set, reject the host if ANY address is blocked (so a
 * mixed answer cannot be raced toward the private one), then answer in the shape
 * the caller asked for.
 */
export function createSafeLookup(opts: SafeLookupOptions = {}): net.LookupFunction {
    const resolver = opts.resolver ?? defaultResolver
    return ((hostname: string, options: unknown, callback: unknown) => {
        const cb = (typeof options === 'function' ? options : callback) as (
            err: NodeJS.ErrnoException | null,
            address: string | LookupAddress[],
            family?: number,
        ) => void
        const o: { all?: boolean; family?: number | string; hints?: number } =
            typeof options === 'object' && options !== null ? options : typeof options === 'number' ? { family: options } : {}
        const family = o.family === 'IPv4' ? 4 : o.family === 'IPv6' ? 6 : typeof o.family === 'number' ? o.family : 0
        const query: LookupAllOptions = { all: true, family, hints: o.hints, order: 'verbatim' }
        resolver(hostname, query, (err, addresses) => {
            if (err) return cb(err, o.all ? [] : '', 0)
            const list = (addresses ?? []).filter((a) => net.isIP(a.address))
            if (list.length === 0) {
                const notFound: NodeJS.ErrnoException = new Error(`getaddrinfo ENOTFOUND ${hostname}`)
                notFound.code = 'ENOTFOUND'
                return cb(notFound, o.all ? [] : '', 0)
            }
            if (!opts.allowPrivate && list.some((a) => isBlockedAddress(a.address))) {
                const blocked: NodeJS.ErrnoException = new Error(`Blocked address for ${hostname}`)
                blocked.code = 'ECLIPBLOCKED'
                return cb(blocked, o.all ? [] : '', 0)
            }
            if (o.all) return cb(null, list)
            const first = list[0] as LookupAddress
            return cb(null, first.address, first.family)
        })
    }) as net.LookupFunction
}

function createSafeDispatcher(allowPrivate: boolean): Dispatcher {
    return new Agent({
        connect: { lookup: createSafeLookup({ allowPrivate }), timeout: 10_000 },
        headersTimeout: FETCH_BUDGET_MS,
        bodyTimeout: FETCH_BUDGET_MS,
    })
}

// Process-wide connection pool; holds no request data.
let sharedDispatcher: Dispatcher | null = null
function safeDispatcher(): Dispatcher {
    sharedDispatcher ??= createSafeDispatcher(false)
    return sharedDispatcher
}

export interface FetchOptions {
    maxBytes: number
    kind: 'html' | 'image'
    /** Shared deadline (epoch ms) so a page plus its image stay inside one budget. */
    deadline?: number
    /** Tests only. */
    allowPrivate?: boolean
    referer?: string
}

export interface FetchedResource {
    body: Uint8Array
    contentType: string
    finalUrl: string
    status: number
}

function assertFetchableUrl(raw: string, allowPrivate: boolean): URL {
    let url: URL
    try {
        url = new URL(raw)
    } catch {
        throw new ClipError('INVALID_URL')
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ClipError('INVALID_URL', url.protocol)
    if (url.username || url.password) throw new ClipError('INVALID_URL', 'credentials in URL')
    if (url.port && !['80', '443', '8080', '8443'].includes(url.port) && !allowPrivate) {
        throw new ClipError('BLOCKED_ADDRESS', `port ${url.port}`)
    }
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    if (!host) throw new ClipError('INVALID_URL')
    if (!allowPrivate) {
        // Literal IPs never reach the lookup hook, so they are checked here.
        if (net.isIP(host) && isBlockedAddress(host)) throw new ClipError('BLOCKED_ADDRESS', host)
        if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
            throw new ClipError('BLOCKED_ADDRESS', host)
        }
    }
    url.hash = ''
    return url
}

function isChallengePage(status: number, headers: Headers, sample: string): boolean {
    if (headers.get('cf-mitigated') === 'challenge') return true
    const server = headers.get('server')?.toLowerCase() ?? ''
    const challengeMarkup =
        /<title>\s*(just a moment|attention required|access denied|verify you are human)/i.test(sample) ||
        sample.includes('challenge-platform') ||
        sample.includes('_cf_chl_opt') ||
        sample.includes('px-captcha') ||
        sample.includes('captcha-delivery.com')
    if (challengeMarkup) return true
    return (status === 403 || status === 503) && (server.includes('cloudflare') || server.includes('akamai'))
}

function mapNetworkError(err: unknown): ClipError {
    if (err instanceof ClipError) return err
    const e = err as { name?: string; code?: string; cause?: { code?: string; name?: string; message?: string } }
    const code = e.cause?.code ?? e.code
    if (e.name === 'AbortError' || e.name === 'TimeoutError' || e.cause?.name === 'AbortError') {
        return new ClipError('TIMEOUT')
    }
    if (code === 'ECLIPBLOCKED') return new ClipError('BLOCKED_ADDRESS')
    if (code === 'UND_ERR_HEADERS_TIMEOUT' || code === 'UND_ERR_BODY_TIMEOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
        return new ClipError('TIMEOUT')
    }
    return new ClipError('NETWORK', code ?? e.cause?.message)
}

/**
 * GET with SSRF protection: every hop is re-validated, DNS answers are checked at
 * connect time (no rebinding window), bodies are capped after decompression, and
 * the whole exchange shares one deadline.
 */
export async function safeFetch(rawUrl: string, options: FetchOptions): Promise<FetchedResource> {
    const allowPrivate = options.allowPrivate === true
    const deadline = options.deadline ?? Date.now() + FETCH_BUDGET_MS
    const dispatcher = allowPrivate ? createSafeDispatcher(true) : safeDispatcher()
    const controller = new AbortController()
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new ClipError('TIMEOUT')
    const timer = setTimeout(() => controller.abort(), remaining)

    try {
        let url = assertFetchableUrl(rawUrl, allowPrivate)
        for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
            const headers: Record<string, string> = {
                ...BROWSER_HEADERS,
                Accept: options.kind === 'html' ? HTML_ACCEPT : IMAGE_ACCEPT,
            }
            if (options.kind === 'image') {
                headers['Sec-Fetch-Dest'] = 'image'
                headers['Sec-Fetch-Mode'] = 'no-cors'
                headers['Sec-Fetch-Site'] = 'cross-site'
                delete headers['Sec-Fetch-User']
                delete headers['Upgrade-Insecure-Requests']
                if (options.referer) headers.Referer = options.referer
            }
            let res: Awaited<ReturnType<typeof undiciFetch>>
            try {
                res = await undiciFetch(url, {
                    method: 'GET',
                    redirect: 'manual',
                    signal: controller.signal,
                    dispatcher,
                    headers,
                })
            } catch (err) {
                throw mapNetworkError(err)
            }

            if (res.status >= 300 && res.status < 400 && res.status !== 304) {
                const location = res.headers.get('location')
                await res.body?.cancel().catch(() => undefined)
                if (!location) throw new ClipError('UPSTREAM', 'redirect without location', res.status)
                url = assertFetchableUrl(new URL(location, url).toString(), allowPrivate)
                continue
            }

            const contentType = res.headers.get('content-type')?.toLowerCase() ?? ''
            const declared = Number(res.headers.get('content-length') ?? '')
            if (Number.isFinite(declared) && declared > options.maxBytes) {
                await res.body?.cancel().catch(() => undefined)
                throw new ClipError('TOO_LARGE')
            }

            const body = await readCapped(res.body, options.maxBytes).catch((err) => {
                throw err instanceof ClipError ? err : mapNetworkError(err)
            })

            if (!res.ok || options.kind === 'html') {
                const sample = new TextDecoder().decode(body.subarray(0, 4096))
                if (isChallengePage(res.status, res.headers, sample)) {
                    throw new ClipError('SITE_BLOCKED', 'challenge', res.status)
                }
            }
            if (res.status === 401 || res.status === 403) throw new ClipError('SITE_BLOCKED', undefined, res.status)
            if (res.status === 404 || res.status === 410) throw new ClipError('NOT_FOUND', undefined, res.status)
            if (res.status === 429) throw new ClipError('RATE_LIMITED', undefined, 429)
            if (!res.ok) throw new ClipError('UPSTREAM', `status ${res.status}`, res.status)

            return { body, contentType, finalUrl: url.toString(), status: res.status }
        }
        throw new ClipError('TOO_MANY_REDIRECTS')
    } finally {
        clearTimeout(timer)
        if (allowPrivate) void (dispatcher as Agent).close().catch(() => undefined)
    }
}

async function readCapped(stream: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Uint8Array> {
    if (!stream) return new Uint8Array(0)
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > maxBytes) {
            await reader.cancel().catch(() => undefined)
            throw new ClipError('TOO_LARGE')
        }
        chunks.push(value)
    }
    const out = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
        out.set(chunk, offset)
        offset += chunk.byteLength
    }
    return out
}

const META_CHARSET = /<meta[^>]+charset\s*=\s*["']?\s*([\w:.-]+)/i

/** Decodes HTML bytes using the header charset, then a meta tag, then UTF-8. */
export function decodeHtml(body: Uint8Array, contentType: string): string {
    const fromHeader = /charset\s*=\s*["']?([\w:.-]+)/i.exec(contentType)?.[1]
    let label = fromHeader
    if (!label) {
        const head = new TextDecoder('latin1').decode(body.subarray(0, 4096))
        label = META_CHARSET.exec(head)?.[1]
    }
    // A UTF-8 BOM wins over any declaration.
    if (body[0] === 0xef && body[1] === 0xbb && body[2] === 0xbf) label = 'utf-8'
    try {
        return new TextDecoder(label ?? 'utf-8', { fatal: false }).decode(body)
    } catch {
        return new TextDecoder('utf-8', { fatal: false }).decode(body)
    }
}

/** Identifies an image by its magic bytes; the declared content type is never trusted. */
export function sniffImageType(body: Uint8Array): string | null {
    const b = body
    if (b.length < 12) return null
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif'
    const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to))
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
    if (ascii(4, 8) === 'ftyp' && /^(avif|avis|mif1|heic|heix)$/.test(ascii(8, 12))) return 'image/avif'
    return null
}
