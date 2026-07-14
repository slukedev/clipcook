/// <reference lib="webworker" />

// Hand-owned service worker on the serwist core runtime, bundled by
// scripts/build-sw.mjs (no framework wrapper — keeps `next build` on
// Turbopack). Runtime caching only: Next's hashed assets and images cache
// on first use; user data (recipes) always goes to the network.

import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist, StaleWhileRevalidate } from 'serwist'

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [
        {
            // App navigations: fresh when online, cached shell when not.
            matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === 'navigate',
            handler: new NetworkFirst({
                cacheName: 'pages',
                networkTimeoutSeconds: 5,
                plugins: [new ExpirationPlugin({ maxEntries: 40 })],
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
            // Recipe photos and other images (incl. Firebase token URLs).
            matcher: ({ request }) => request.destination === 'image',
            handler: new CacheFirst({
                cacheName: 'images',
                plugins: [new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 30 * 24 * 3600 })],
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
    ],
})

serwist.addEventListeners()
