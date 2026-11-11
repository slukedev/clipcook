import { defineConfig, devices } from '@playwright/test'
import { BASE_URL, E2E_PORT, SERVER_ENV, STORAGE_STATE } from './tests/e2e/support/env'

export default defineConfig({
    testDir: 'tests/e2e',
    globalSetup: './tests/e2e/global-setup.ts',
    // Every test signs in as the same demo cook against one file store, so tests that
    // touch per-account state (grocery list, displays, imports) must not overlap.
    fullyParallel: false,
    workers: 1,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    timeout: 45_000,
    expect: { timeout: 10_000 },
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL: BASE_URL,
        storageState: STORAGE_STATE,
        trace: 'off',
        reducedMotion: 'reduce',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
        },
        {
            name: 'mobile',
            use: { ...devices['Pixel 7'] },
        },
    ],
    webServer: {
        // Builds first so the suite always tests the current source as production runs it.
        command: `npm run build && npx next start --port ${E2E_PORT}`,
        url: `${BASE_URL}/login`,
        env: SERVER_ENV,
        // A fresh server also resets the in-memory rate limits (display pairing allows 6 codes
        // per 10 minutes). E2E_REUSE_SERVER=1 skips the build while writing tests.
        reuseExistingServer: process.env.E2E_REUSE_SERVER === '1',
        timeout: 300_000,
        stdout: 'ignore',
        stderr: 'pipe',
    },
})
