import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_INSTANCE } from '@/server/db/types'
import { resolveUpdaterSetup, tokenFormUrl, UPSTREAM } from '@/server/updater/config'
import { GitHubClient } from '@/server/updater/github'
import { fileMap, lastSyncedCommit, planTree, updateCommitMessage } from '@/server/updater/plan'
import { checkForUpdate, installUpdate } from '@/server/updater/service'
import { FakeGitHub } from './fake-github'

const MINE = 'cook/my-clipcook'
const TOKEN = 'github_pat_test'
const config = { token: TOKEN, repo: MINE, branch: null }

const f = (sha: string, mode = '100644') => ({ mode, type: 'blob' as const, sha })
const map = (files: Record<string, string>) =>
    fileMap(Object.entries(files).map(([p, sha]) => ({ path: p, ...f(sha) })))

describe('planTree', () => {
    it('mirrors upstream exactly on a first update, leaving .github alone', () => {
        const plan = planTree({
            base: null,
            head: map({ 'a.ts': 'A2', 'b.ts': 'B', '.github/workflows/ci.yml': 'CI2' }),
            current: map({ 'a.ts': 'A1', 'b.ts': 'B', 'gone.ts': 'G', '.github/workflows/ci.yml': 'CI1' }),
        })
        expect(plan.writes.map((w) => [w.path, w.sha])).toEqual([['a.ts', 'A2']])
        expect(plan.deletes).toEqual(['gone.ts'])
        expect(plan.overwritten).toEqual([])
    })

    it('with a known base, touches only what upstream changed and keeps local edits elsewhere', () => {
        const plan = planTree({
            base: map({ 'a.ts': 'A1', 'b.ts': 'B1', 'c.ts': 'C1', 'old.ts': 'O', 'edited.ts': 'E1' }),
            head: map({ 'a.ts': 'A2', 'b.ts': 'B1', 'c.ts': 'C1', 'new.ts': 'N', 'edited.ts': 'E2' }),
            current: map({
                'a.ts': 'A1',
                'b.ts': 'B-local',
                'c.ts': 'C1',
                'old.ts': 'O',
                'edited.ts': 'E-local',
                'mine.ts': 'M',
            }),
        })
        expect(plan.writes.map((w) => w.path).sort()).toEqual(['a.ts', 'edited.ts', 'new.ts'])
        expect(plan.deletes).toEqual(['old.ts'])
        // b.ts and mine.ts are local changes upstream never touched; edited.ts was changed on both sides.
        expect(plan.overwritten).toEqual(['edited.ts'])
    })

    it('counts a mode change as a change and skips files already at upstream', () => {
        const base = fileMap([{ path: 'run.sh', ...f('S') }])
        const head = fileMap([{ path: 'run.sh', ...f('S', '100755') }])
        expect(planTree({ base, head, current: base }).writes).toEqual([{ path: 'run.sh', ...f('S', '100755') }])
        expect(planTree({ base, head, current: head }).writes).toEqual([])
    })

    it('reads the newest Upstream-Commit trailer and marks update commits to skip CI', () => {
        const sha = 'a'.repeat(40)
        const message = updateCommitMessage(sha)
        expect(message.split('\n')[0]).toContain('[skip ci]')
        expect(lastSyncedCommit(['Fix my typo', message, updateCommitMessage('b'.repeat(40))])).toBe(sha)
        expect(lastSyncedCommit(['Initial commit'])).toBeNull()
    })
})

describe('resolveUpdaterSetup', () => {
    const vercel = { VERCEL_GIT_PROVIDER: 'github', VERCEL_GIT_REPO_OWNER: 'cook', VERCEL_GIT_REPO_SLUG: 'my-clipcook' }

    it('hides on the upstream deployment and on a bare local checkout', () => {
        expect(
            resolveUpdaterSetup(
                { ...vercel, VERCEL_GIT_REPO_OWNER: 'SlukeDev', VERCEL_GIT_REPO_SLUG: 'ClipCook' },
                'firebase',
            ).kind,
        ).toBe('hidden')
        expect(resolveUpdaterSetup({}, 'local').kind).toBe('hidden')
    })

    it('reads the repository from Vercel and asks only for what is missing', () => {
        expect(resolveUpdaterSetup(vercel, 'firebase')).toEqual({ kind: 'missing', missing: ['token'], repo: MINE })
        expect(resolveUpdaterSetup({ CLIPCOOK_UPDATE_TOKEN: 't' }, 'firebase')).toEqual({
            kind: 'missing',
            missing: ['repo'],
            repo: null,
        })
        expect(resolveUpdaterSetup({ ...vercel, CLIPCOOK_UPDATE_TOKEN: ' t ' }, 'firebase')).toEqual({
            kind: 'ready',
            config: { token: 't', repo: MINE, branch: null },
        })
    })

    it('rejects a malformed explicit repository instead of calling GitHub with it', () => {
        const setup = resolveUpdaterSetup(
            { CLIPCOOK_UPDATE_TOKEN: 't', CLIPCOOK_UPDATE_REPO: '../../evil' },
            'firebase',
        )
        expect(setup.kind).toBe('missing')
    })

    it('prefills the token form for the repository owner', () => {
        const url = new URL(tokenFormUrl(MINE))
        expect(url.searchParams.get('target_name')).toBe('cook')
        expect(url.searchParams.get('contents')).toBe('write')
        expect(url.searchParams.get('name')?.length).toBeLessThanOrEqual(40)
    })
})

describe('update flow against GitHub', () => {
    let gh: FakeGitHub
    let client: GitHubClient
    const V1 = {
        'package.json': '{"v":1}',
        'src/a.ts': 'a1',
        'src/b.ts': 'b1',
        'src/old.ts': 'old',
        '.github/workflows/ci.yml': 'ci1',
    }

    beforeEach(() => {
        gh = new FakeGitHub()
        gh.createRepo(UPSTREAM.repo)
        gh.createRepo(MINE)
        gh.tokens.set(TOKEN, new Set([MINE]))
        gh.commitFiles(UPSTREAM.repo, V1, 'v1')
        // A deploy-button clone: same files, unrelated history.
        gh.commitFiles(MINE, V1, 'Initial commit')
        client = new GitHubClient({ token: TOKEN, fetch: gh.fetch })
    })

    const instance = { ...DEFAULT_INSTANCE }

    it('reports a fresh clone of the latest upstream as current', async () => {
        expect((await checkForUpdate(config, instance, { client })).state).toBe('current')
    })

    it('installs twice in a row: mirrors first, then merges while keeping local edits', async () => {
        const { 'src/old.ts': _removed, ...kept } = V1
        gh.commitFiles(
            UPSTREAM.repo,
            { ...kept, 'src/a.ts': 'a2', 'src/new.ts': 'new', '.github/workflows/ci.yml': 'ci2' },
            'v2',
        )
        const status = await checkForUpdate(config, instance, { client })
        expect(status).toMatchObject({ state: 'available', commits: null })

        const first = await installUpdate(config, { client })
        expect(first.outcome).toBe('installed')
        const afterFirst = gh.files(MINE)
        expect(afterFirst['src/a.ts']).toBe('a2')
        expect(afterFirst['src/new.ts']).toBe('new')
        expect(afterFirst['src/old.ts']).toBeUndefined()
        // The deployment's own workflow file is never touched.
        expect(afterFirst['.github/workflows/ci.yml']).toBe('ci1')
        expect(gh.head(MINE).message).toContain('[skip ci]')
        expect((await checkForUpdate(config, instance, { client })).state).toBe('current')

        // The owner customizes the deployment, then upstream moves on.
        gh.commitFiles(MINE, { ...gh.files(MINE), 'src/b.ts': 'b-mine', 'src/mine.ts': 'mine' }, 'My tweak')
        const v3 = gh.commitFiles(UPSTREAM.repo, { ...gh.files(UPSTREAM.repo), 'src/a.ts': 'a3' }, 'v3')
        expect(await checkForUpdate(config, instance, { client })).toMatchObject({ state: 'available', commits: 1 })

        const second = await installUpdate(config, { client })
        expect(second).toMatchObject({ outcome: 'installed', upstreamSha: v3, overwritten: [] })
        const afterSecond = gh.files(MINE)
        expect(afterSecond['src/a.ts']).toBe('a3')
        expect(afterSecond['src/b.ts']).toBe('b-mine')
        expect(afterSecond['src/mine.ts']).toBe('mine')
    })

    it('never overwrites a push that lands during the update', async () => {
        gh.commitFiles(UPSTREAM.repo, { ...V1, 'src/a.ts': 'a2' }, 'v2')
        gh.beforeRequest = (method, p) => {
            if (method === 'PATCH' && p.startsWith(`/repos/${MINE}/git/refs`)) {
                gh.beforeRequest = null
                gh.commitFiles(MINE, { ...V1, 'src/b.ts': 'pushed meanwhile' }, 'Racing push')
            }
        }
        await expect(installUpdate(config, { client })).rejects.toMatchObject({ kind: 'conflict' })
        expect(gh.files(MINE)['src/b.ts']).toBe('pushed meanwhile')
    })

    it('turns missing write access into a sentence the owner can act on', async () => {
        gh.tokens.set(TOKEN, new Set())
        gh.commitFiles(UPSTREAM.repo, { ...V1, 'src/a.ts': 'a2' }, 'v2')
        await expect(installUpdate(config, { client })).rejects.toMatchObject({ kind: 'forbidden' })
        const bad = new GitHubClient({ token: 'wrong', fetch: gh.fetch })
        const status = await checkForUpdate(config, instance, { client: bad })
        expect(status).toMatchObject({ state: 'error' })
        expect(status.state === 'error' && status.message).toMatch(/CLIPCOOK_UPDATE_TOKEN/)
    })

    it('shows the pushed update as deploying until the host runs that commit', async () => {
        const now = Date.parse('2026-02-01T12:00:00Z')
        const log = {
            at: now - 60_000,
            outcome: 'installed' as const,
            upstreamSha: 'u'.repeat(40),
            commitSha: 'c'.repeat(40),
            error: null,
        }
        vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'old')
        expect((await checkForUpdate(config, { ...instance, lastUpdate: log }, { client, now })).state).toBe(
            'deploying',
        )
        vi.stubEnv('VERCEL_GIT_COMMIT_SHA', log.commitSha)
        expect((await checkForUpdate(config, { ...instance, lastUpdate: log }, { client, now })).state).toBe('current')
        vi.unstubAllEnvs()
    })
})

describe('GET /api/cron/update', () => {
    let dir: string
    let gh: FakeGitHub
    let route: typeof import('@/app/api/cron/update/route')
    let db: typeof import('@/server/db')

    beforeAll(async () => {
        dir = await mkdtemp(path.join(os.tmpdir(), 'clipcook-updater-'))
        vi.stubEnv('CLIPCOOK_BACKEND', 'local')
        vi.stubEnv('CLIPCOOK_DATA_DIR', dir)
        route = await import('@/app/api/cron/update/route')
        db = await import('@/server/db')
    })

    beforeEach(async () => {
        gh = new FakeGitHub()
        gh.createRepo(UPSTREAM.repo)
        gh.createRepo(MINE)
        gh.tokens.set(TOKEN, new Set([MINE]))
        gh.commitFiles(UPSTREAM.repo, { 'a.ts': 'a1' }, 'v1')
        gh.commitFiles(MINE, { 'a.ts': 'a1' }, 'Initial commit')
        gh.commitFiles(UPSTREAM.repo, { 'a.ts': 'a2' }, 'v2')
        vi.stubGlobal('fetch', gh.fetch)
        vi.stubEnv('CLIPCOOK_UPDATE_TOKEN', TOKEN)
        vi.stubEnv('CLIPCOOK_UPDATE_REPO', MINE)
        const store = await db.getStore()
        await store.updateInstance(() => ({ ...DEFAULT_INSTANCE }))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.stubEnv('CRON_SECRET', '')
    })

    afterAll(async () => {
        vi.unstubAllEnvs()
        await rm(dir, { recursive: true, force: true })
    })

    const call = (auth?: string) =>
        route.GET(
            new NextRequest('https://clipcook.test/api/cron/update', { headers: auth ? { authorization: auth } : {} }),
        )

    it('with CRON_SECRET set, rejects anything but the scheduler and installs for it', async () => {
        vi.stubEnv('CRON_SECRET', 'cron-secret-value')
        expect((await call()).status).toBe(401)
        expect((await call('Bearer nope')).status).toBe(401)
        expect(gh.calls).toEqual([])
        const res = await call('Bearer cron-secret-value')
        expect(await res.json()).toEqual({ ran: true, error: null })
        expect(gh.files(MINE)['a.ts']).toBe('a2')
    })

    it('without CRON_SECRET, runs at most once per interval however often it is called', async () => {
        const results = await Promise.all([call(), call(), call()])
        const bodies = await Promise.all(results.map((r) => r.json()))
        expect(bodies.filter((b) => b.ran)).toHaveLength(1)
        expect(bodies.filter((b) => b.reason === 'too_soon')).toHaveLength(2)
    })

    it('does nothing when the owner turned auto update off', async () => {
        const store = await db.getStore()
        await store.updateInstance(() => ({ autoUpdate: false }))
        expect(await (await call()).json()).toEqual({ ran: false, reason: 'off' })
        expect(gh.calls).toEqual([])
    })
})
