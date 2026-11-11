// Exports recipes from an older ClipCook Firebase project into ClipCook export
// files you can load with Settings > Import in the new app.
//
// Usage:
//   node --env-file=.env.legacy scripts/export-legacy.mjs [--email you@example.com] [--out exports]
//
// .env.legacy holds the OLD project's service account:
//   LEGACY_FIREBASE_ADMIN_PROJECT_ID, LEGACY_FIREBASE_ADMIN_CLIENT_EMAIL, LEGACY_FIREBASE_ADMIN_PRIVATE_KEY
//
// Photos are downloaded and embedded so the import stores them in the new project.
// Output is split into files under the 25 MB import limit.

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const MAX_FILE_BYTES = 20 * 1024 * 1024

const { values: args } = parseArgs({
    options: { email: { type: 'string' }, out: { type: 'string', default: 'exports' } },
})

function env(key) {
    const value = process.env[key]
    if (!value) {
        console.error(`Missing ${key}. Put the old project's service account in .env.legacy.`)
        process.exit(1)
    }
    return value
}

const app = initializeApp({
    credential: cert({
        projectId: env('LEGACY_FIREBASE_ADMIN_PROJECT_ID'),
        clientEmail: env('LEGACY_FIREBASE_ADMIN_CLIENT_EMAIL'),
        privateKey: env('LEGACY_FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n'),
    }),
})
const db = getFirestore(app)

const str = (v) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const lines = (v) =>
    Array.isArray(v)
        ? v
              .map(str)
              .map((s) => s.trim())
              .filter(Boolean)
        : []
const millis = (v) => (typeof v === 'number' ? v : v && typeof v.toMillis === 'function' ? v.toMillis() : undefined)

function httpsUrl(v) {
    try {
        return new URL(v).protocol === 'https:' ? v : null
    } catch {
        return null
    }
}

async function photoDataUrl(data) {
    if (typeof data.image === 'string' && data.image.startsWith('data:image/')) return data.image
    const url = str(data.imageUrl) || (str(data.image).startsWith('https://') ? str(data.image) : '')
    if (!url) return ''
    try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const type = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
        const bytes = Buffer.from(await res.arrayBuffer())
        return `data:${type};base64,${bytes.toString('base64')}`
    } catch (err) {
        console.warn(`  Photo skipped for "${str(data.title)}": ${err.message}`)
        return ''
    }
}

async function main() {
    let query = db.collection('allRecipes')
    if (args.email) {
        const user = await getAuth(app).getUserByEmail(args.email)
        query = query.where('uid', '==', user.uid)
    }
    const snap = await query.get()
    const uids = new Set(snap.docs.map((d) => d.get('uid')))
    if (!args.email && uids.size > 1) {
        console.error(`Found recipes from ${uids.size} accounts. Pass --email to pick yours.`)
        process.exit(1)
    }
    console.log(`Exporting ${snap.size} recipes...`)

    const recipes = []
    for (const doc of snap.docs) {
        const d = doc.data()
        const title = str(d.title).trim()
        if (!title) continue
        recipes.push({
            id: doc.id,
            title,
            description: str(d.description),
            servings: str(d.servings),
            prepTime: str(d.prepTime),
            cookTime: str(d.cookTime),
            totalTime: str(d.totalTime),
            ingredients: lines(d.ingredients),
            instructions: lines(d.instructions),
            notes: str(d.notes),
            image: await photoDataUrl(d),
            tags: lines(d.tags),
            sourceUrl: httpsUrl(str(d.sourceUrl)),
            createdAt: millis(d.createdAt),
        })
    }

    await mkdir(args.out, { recursive: true })
    const exportedAt = new Date().toISOString()
    const files = []
    let batch = []
    let size = 0
    for (const recipe of recipes) {
        const bytes = Buffer.byteLength(JSON.stringify(recipe))
        if (batch.length && size + bytes > MAX_FILE_BYTES) {
            files.push(batch)
            batch = []
            size = 0
        }
        batch.push(recipe)
        size += bytes
    }
    if (batch.length) files.push(batch)

    for (const [i, part] of files.entries()) {
        const path = join(args.out, `clipcook-export-${i + 1}.json`)
        const body = { schema: 'clipcook.export.v1', exportedAt, recipes: part, collections: [], grocery: [] }
        await writeFile(path, JSON.stringify(body))
        console.log(`Wrote ${path} (${part.length} recipes)`)
    }
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
