/**
 * Renders the ClipCook mark (a cream cookie with a saffron yolk on paprika) into
 * every icon file the app and the web manifest reference, using MaterialShapes.
 *
 *   npx esbuild scripts/generate-brand-icons.ts --bundle --platform=node --format=cjs \
 *     --outfile=node_modules/.cache/generate-brand-icons.cjs --external:sharp \
 *     && node node_modules/.cache/generate-brand-icons.cjs
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { SHAPE_PATHS } from '../src/components/ui/shape/shape-paths'

const PAPRIKA = '#C2502A'
const CREAM = '#FFF4EE'
const SAFFRON = '#FFBE3D'

const publicDir = join(__dirname, '..', '..', 'public')

/**
 * The mark in a 100 by 100 box. `inset` shrinks the artwork toward the center
 * (maskable icons keep it inside the 80% safe zone); `radius` rounds the tile
 * (0 for full-bleed icons that the platform masks itself).
 */
function markSvg(size: number, { inset = 1, radius = 22 }: { inset?: number; radius?: number } = {}): string {
    const cookie = SHAPE_PATHS.cookie9
    const yolk = SHAPE_PATHS.circle
    const art = `
        <g transform="translate(50 50) scale(${inset}) translate(-50 -50)">
            <g transform="translate(17 22) scale(0.62)"><path d="${cookie}" fill="${CREAM}"/></g>
            <g transform="translate(55 15) scale(0.29)"><path d="${yolk}" fill="${SAFFRON}"/></g>
        </g>`
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="${radius}" fill="${PAPRIKA}"/>
        ${art}
    </svg>`
}

async function png(file: string, size: number, options?: Parameters<typeof markSvg>[1]) {
    const buffer = await sharp(Buffer.from(markSvg(size, options)))
        .png({ compressionLevel: 9 })
        .toBuffer()
    writeFileSync(join(publicDir, file), buffer)
    return buffer
}

/** A .ico holding PNG images (supported by every browser that still asks for one). */
function ico(images: { size: number; data: Buffer }[]): Buffer {
    const header = Buffer.alloc(6)
    header.writeUInt16LE(0, 0)
    header.writeUInt16LE(1, 2)
    header.writeUInt16LE(images.length, 4)
    const entries: Buffer[] = []
    let offset = 6 + 16 * images.length
    for (const { size, data } of images) {
        const entry = Buffer.alloc(16)
        entry.writeUInt8(size >= 256 ? 0 : size, 0)
        entry.writeUInt8(size >= 256 ? 0 : size, 1)
        entry.writeUInt8(0, 2)
        entry.writeUInt8(0, 3)
        entry.writeUInt16LE(1, 4)
        entry.writeUInt16LE(32, 6)
        entry.writeUInt32LE(data.length, 8)
        entry.writeUInt32LE(offset, 12)
        offset += data.length
        entries.push(entry)
    }
    return Buffer.concat([header, ...entries, ...images.map((i) => i.data)])
}

async function main() {
    for (const size of [192, 256, 384, 512]) await png(`icon-${size}x${size}.png`, size)
    // Maskable: full bleed, artwork inside the 80% safe zone.
    await png('icon-maskable-512x512.png', 512, { inset: 0.8, radius: 0 })
    await png('icon-maskable-192x192.png', 192, { inset: 0.8, radius: 0 })
    // iOS rounds the corners itself.
    await png('apple-touch-icon.png', 180, { inset: 0.86, radius: 0 })

    const small = await Promise.all(
        [16, 32, 48].map(async (size) => ({
            size,
            data: await sharp(Buffer.from(markSvg(size)))
                .png()
                .toBuffer(),
        })),
    )
    writeFileSync(join(publicDir, 'favicon.ico'), ico(small))
    writeFileSync(
        join(publicDir, 'logo.webp'),
        await sharp(Buffer.from(markSvg(256)))
            .webp({ quality: 92 })
            .toBuffer(),
    )
    writeFileSync(join(publicDir, 'icon.svg'), markSvg(512).replace(/\s+\n/g, '\n'))
    console.log(`Wrote brand icons to ${publicDir}`)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
