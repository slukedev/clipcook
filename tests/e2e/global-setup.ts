import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium, type FullConfig } from '@playwright/test'
import { BASE_URL, DATA_DIR, SERVER_ENV, STORAGE_STATE } from './support/env'

export default async function globalSetup(_config: FullConfig): Promise<void> {
    mkdirSync(DATA_DIR, { recursive: true })
    // The server is already up (webServer starts first); the local store notices the rewritten file.
    execFileSync('npm', ['run', '--silent', 'seed:demo'], {
        env: { ...process.env, ...SERVER_ENV },
        stdio: 'inherit',
    })

    const browser = await chromium.launch()
    try {
        const page = await browser.newPage({ baseURL: BASE_URL })
        await page.goto('/login')
        await page.getByRole('button', { name: 'Continue as demo cook' }).click()
        await page.waitForURL('/')
        await page.getByRole('heading', { name: 'Library', level: 1 }).waitFor({ state: 'attached' })
        await page.context().storageState({ path: STORAGE_STATE })
    } finally {
        await browser.close()
    }
}
