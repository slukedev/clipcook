/// <reference lib="webworker" />

// Hand-owned service worker on the serwist core runtime, bundled by
// scripts/build-sw.mjs (no framework wrapper, so `next build` stays on Turbopack).
// Runtime caching only. API responses, server actions and RSC payloads always go
// to the network; pages are network-first with /offline as the fallback.

import {
    CacheFirst,
    ExpirationPlugin,
    NetworkFirst,
    NetworkOnly,
    Serwist,
    type SerwistPlugin,
    StaleWhileRevalidate,
} from 'serwist'

declare const self: ServiceWorkerGlobalScope
declare const __SW_VERSION__: string

const OFFLINE_URL = '/offline'
const OFFLINE_CACHE = `offline-${__SW_VERSION__}`
const PAGES_CACHE = 'pages'

/** The offline page plus the CSS and JS it links, so it renders with no network at all. */
async function cacheOfflinePage(): Promise<void> {
    const cache = await caches.open(OFFLINE_CACHE)
    const res = await fetch(OFFLINE_URL, { cache: 'reload', credentials: 'omit' })
    // A redirect (to sign-in) is not the offline page; keep whatever was cached before.
    if (!res.ok || res.redirected) return
    const html = await res.clone().text()
    await cache.put(OFFLINE_URL, res)
    const assets = new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) ?? [])
    await Promise.all(
        [...assets].map((url) =>
            fetch(url)
                .then((r) => (r.ok ? cache.put(url, r) : undefined))
                .catch(() => undefined),
        ),
    )
}

async function offlineResponse(): Promise<Response> {
    const cached = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE })
    return cached ?? new Response('You are offline.', { status: 503, headers: { 'content-type': 'text/plain' } })
}

const offlineFallback: SerwistPlugin = {
    handlerDidError: () => offlineResponse(),
}

/** Never store anything that is not a plain successful page. */
const pagesOnly: SerwistPlugin = {
    cacheWillUpdate: async ({ response }) => (response.ok && !response.redirected ? response : null),
}

const serwist = new Serwist({
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [
        {
            // Never cached: API routes, server actions and RSC payloads carry user data.
            matcher: ({ url, request, sameOrigin }) =>
                sameOrigin &&
                (url.pathname.startsWith('/api/') ||
                    request.method !== 'GET' ||
                    request.headers.has('next-action') ||
                    request.headers.get('rsc') === '1'),
            handler: new NetworkOnly(),
        },
        {
            // Clipping and signing in only make sense online; offline they get the
            // offline page, which offers to retry the same address.
            matcher: ({ url, request, sameOrigin }) =>
                sameOrigin &&
                request.mode === 'navigate' &&
                (url.pathname === '/clip' || url.pathname.startsWith('/login') || url.pathname === OFFLINE_URL),
            handler: new NetworkOnly({ plugins: [offlineFallback] }),
        },
        {
            // Other pages: fresh when online, the last copy when not.
            matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === 'navigate',
            handler: new NetworkFirst({
                cacheName: PAGES_CACHE,
                networkTimeoutSeconds: 5,
                plugins: [
                    pagesOnly,
                    new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 7 * 24 * 3600 }),
                    offlineFallback,
                ],
            }),
        },
        {
            // Hash-named build assets are immutable.
            matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/_next/static/'),
            handler: new CacheFirst({
                cacheName: 'build-assets',
                plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 3600 })],
            }),
        },
        {
            // Fonts.
            matcher: ({ request }) => request.destination === 'font',
            handler: new CacheFirst({
                cacheName: 'fonts',
                plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 3600 })],
            }),
        },
        {
            // Optimized image endpoint.
            matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/_next/image'),
            handler: new StaleWhileRevalidate({
                cacheName: 'next-image',
                plugins: [new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 30 * 24 * 3600 })],
            }),
        },
        {
            // Recipe photos and other images (incl. Firebase token URLs).
            matcher: ({ request }) => request.destination === 'image',
            handler: new CacheFirst({
                cacheName: 'images',
                plugins: [new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 30 * 24 * 3600 })],
            }),
        },
    ],
})

self.addEventListener('install', (event) => {
    event.waitUntil(cacheOfflinePage().catch(() => undefined))
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys.filter((k) => k.startsWith('offline-') && k !== OFFLINE_CACHE).map((k) => caches.delete(k)),
                ),
            ),
    )
})

// Signing out drops cached pages, so the next person on this device does not see them.
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url)
    const leaving =
        url.pathname === '/api/auth/signout' || (event.request.mode === 'navigate' && url.pathname.startsWith('/login'))
    if (url.origin === self.location.origin && leaving) {
        event.waitUntil(caches.delete(PAGES_CACHE))
    }
})

serwist.addEventListeners()
