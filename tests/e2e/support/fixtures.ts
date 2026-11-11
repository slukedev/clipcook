import { test as base, expect, type Page, type TestInfo } from '@playwright/test'

/**
 * Console messages that are not ClipCook's to fix. Keep each entry narrow and say why.
 * Empty for now: the app logs nothing at error level on the paths these tests drive.
 */
const ALLOWED_CONSOLE_ERRORS: RegExp[] = []

/**
 * Collects uncaught exceptions and console.error output from a page, for failing the test.
 * `allow` adds patterns for errors a specific test causes on purpose.
 */
export function watchConsole(page: Page, problems: string[], allow: RegExp[] = []): void {
    page.on('pageerror', (error) => problems.push(`pageerror on ${page.url()}: ${error.message}`))
    page.on('console', (message) => {
        if (message.type() !== 'error') return
        const text = message.text()
        if ([...ALLOWED_CONSOLE_ERRORS, ...allow].some((pattern) => pattern.test(text))) return
        problems.push(`console.error on ${page.url()}: ${text}`)
    })
}

/** A title no other test or earlier run shares, so assertions never match someone else's data. */
export function unique(testInfo: TestInfo, label: string): string {
    const stamp = `${Date.now().toString(36)}${testInfo.workerIndex}`
    return `${label} ${testInfo.project.name} ${stamp}`
}

export const test = base.extend<{ consoleProblems: string[] }>({
    consoleProblems: [
        async ({ context }, use) => {
            const problems: string[] = []
            for (const page of context.pages()) watchConsole(page, problems)
            context.on('page', (page) => watchConsole(page, problems))
            await use(problems)
            expect(problems, 'no uncaught errors or console.error output').toEqual([])
        },
        { auto: true },
    ],
})

export { expect }
