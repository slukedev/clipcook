/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    reactCompiler: true,
    experimental: {
        // Destinations and on-screen recipe cards prefetch whole pages so navigations commit in
        // one step (no skeleton, photos morph); a minute bounds how stale such a page can be
        // when edited elsewhere. Visited pages are reused for 30 seconds, so hopping between
        // tabs and back is instant. Our own edits revalidate either way.
        staleTimes: { static: 60, dynamic: 30 },
        serverActions: {
            // Original photos upload as FormData Files; the client pre-resizes
            // to ~2560px so real payloads stay a fraction of this.
            bodySizeLimit: '12mb',
        },
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
            { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
        ],
    },
    async redirects() {
        return [{ source: '/create', destination: '/new', permanent: true }]
    },
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
                    { key: 'X-DNS-Prefetch-Control', value: 'on' },
                    // NOT `same-origin`: that would break signInWithPopup.
                    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=63072000; includeSubDomains; preload',
                    },
                ],
            },
            {
                source: '/sw.js',
                headers: [
                    { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
                    { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
                ],
            },
        ]
    },
}

module.exports = nextConfig
