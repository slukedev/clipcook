import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            // The real package throws outside a react-server bundle.
            'server-only': fileURLToPath(new URL('./tests/unit/stubs/server-only.ts', import.meta.url)),
        },
    },
    test: {
        environment: 'node',
        include: ['tests/unit/**/*.test.ts'],
        testTimeout: 15_000,
        // Ships extensionless ESM imports that Node's resolver rejects; let Vite transform it.
        server: { deps: { inline: ['@material/material-color-utilities'] } },
    },
})
