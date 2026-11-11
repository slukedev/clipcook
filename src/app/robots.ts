import type { MetadataRoute } from 'next'

/** A private app: only the sign-in page is meant for search engines. */
export default function robots(): MetadataRoute.Robots {
    const base = process.env.APP_URL?.replace(/\/+$/, '')
    return {
        rules: { userAgent: '*', allow: ['/login', '/opengraph-image'], disallow: '/' },
        sitemap: base ? `${base}/sitemap.xml` : undefined,
    }
}
