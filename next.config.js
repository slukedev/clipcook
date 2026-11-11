/** @type {import('next').NextConfig} */
const nextConfig = {
    // Next 16.2's file tracing keeps sharp's loader but drops the libvips shared library
    // it opens, so every server render failed on Vercel with ERR_DLOPEN_FAILED.
    outputFileTracingIncludes: {
        '/**': ['./node_modules/@img/sharp-libvips-linux-x64/lib/**/*'],
    },
    reactStrictMode: true,
    poweredByHeader: false,
    reactCompiler: true,
    experimental: {
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
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
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
