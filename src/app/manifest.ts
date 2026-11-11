import type { MetadataRoute } from 'next'
import { schemeFromSeed } from '@/lib/theme/scheme'
import { BRAND_SEED } from '@/lib/theme/seed'

const surface = schemeFromSeed(BRAND_SEED).surface ?? '#fff8f6'

export default function manifest(): MetadataRoute.Manifest {
    return {
        id: '/',
        name: 'ClipCook',
        short_name: 'ClipCook',
        description: 'Save recipes from any website and cook them step by step.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: surface,
        background_color: surface,
        categories: ['food', 'lifestyle'],
        icons: [
            { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        share_target: {
            action: '/clip',
            method: 'GET',
            params: { title: 'title', text: 'text', url: 'url' },
        },
        shortcuts: [
            { name: 'Clip a recipe', short_name: 'Clip', url: '/clip?mode=link' },
            { name: 'Grocery list', short_name: 'Grocery', url: '/grocery' },
        ],
    }
}
