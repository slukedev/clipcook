// Bundles the service worker (src/sw.ts → public/sw.js) ahead of `next build`.
// Owning this step (instead of @serwist/next's webpack plugin) lets the app
// build with Turbopack.
import { build } from 'esbuild'

await build({
    entryPoints: ['src/sw.ts'],
    outfile: 'public/sw.js',
    bundle: true,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'info',
})
