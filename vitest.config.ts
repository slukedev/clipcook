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
    },
})
