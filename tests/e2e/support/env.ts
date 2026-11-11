import path from 'node:path'

export const E2E_PORT = 3130
export const BASE_URL = `http://localhost:${E2E_PORT}`
export const DATA_DIR = path.resolve(__dirname, '../../../.data-e2e')
export const STORAGE_STATE = path.join(DATA_DIR, 'demo-cook.json')
export const AUTH_SECRET = 'e2e-only-not-a-secret-0123456789abcdef'

/** What the production server and the seed script both need to share one local store. */
export const SERVER_ENV = {
    CLIPCOOK_BACKEND: 'local',
    CLIPCOOK_DATA_DIR: DATA_DIR,
    LOCAL_AUTH_SECRET: AUTH_SECRET,
    APP_URL: BASE_URL,
    // Set on purpose: production must ignore it (see clip.spec.ts).
    CLIPCOOK_CLIP_ALLOW_PRIVATE: '1',
}
