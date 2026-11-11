// Client-side photo work: downscale before upload and pick a seed color for the preview.

import type { Contrast } from '@/lib/theme/preference'

const MAX_EDGE = 2560
/** Small enough files that already fit are sent as they are. */
const KEEP_BELOW_BYTES = 1_500_000

async function decode(source: Blob | string): Promise<ImageBitmap | HTMLImageElement> {
    if (typeof source !== 'string') return createImageBitmap(source, { imageOrientation: 'from-image' })
    const img = new Image()
    img.decoding = 'async'
    img.src = source
    await img.decode()
    return img
}

function sizeOf(image: ImageBitmap | HTMLImageElement): { width: number; height: number } {
    return 'naturalWidth' in image
        ? { width: image.naturalWidth, height: image.naturalHeight }
        : { width: image.width, height: image.height }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Resizes to fit 2560px and re-encodes as WebP (JPEG where WebP encoding is missing).
 * Returns the original when it already fits or cannot be decoded here (HEIC on
 * some browsers); the server validates and converts it.
 */
export async function preparePhoto(file: Blob): Promise<Blob> {
    let image: ImageBitmap
    try {
        image = await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
        return file
    }
    const { width, height } = image
    const ratio = Math.min(1, MAX_EDGE / Math.max(width, height))
    if (ratio === 1 && file.size <= KEEP_BELOW_BYTES && /^image\/(jpeg|png|webp)$/.test(file.type)) {
        image.close()
        return file
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * ratio))
    canvas.height = Math.max(1, Math.round(height * ratio))
    const ctx = canvas.getContext('2d')
    if (!ctx) {
        image.close()
        return file
    }
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    image.close()
    const webp = await canvasBlob(canvas, 'image/webp', 0.86)
    if (webp?.type === 'image/webp') return webp
    return (await canvasBlob(canvas, 'image/jpeg', 0.88)) ?? file
}

/** The dominant, most usable color of a photo, scored the way Material picks wallpaper seeds. */
export async function seedFromPhoto(source: Blob | string): Promise<number | null> {
    try {
        const [image, mcu] = await Promise.all([decode(source), import('@material/material-color-utilities')])
        const { width, height } = sizeOf(image)
        const scale = Math.min(1, 112 / Math.max(width, height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(width * scale))
        canvas.height = Math.max(1, Math.round(height * scale))
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return null
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        if ('close' in image) image.close()
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        const pixels: number[] = []
        for (let i = 0; i < data.length; i += 4) {
            if ((data[i + 3] ?? 0) < 255) continue
            pixels.push(mcu.argbFromRgb(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0))
        }
        const ranked = mcu.Score.score(mcu.QuantizerCelebi.quantize(pixels, 128))
        return ranked[0] ?? null
    } catch {
        return null
    }
}

/** Scoped color roles for a seed, light and dark, as a stylesheet string. */
export async function photoColorCss(selector: string, seed: number, contrast: Contrast): Promise<string> {
    const { dynamicColorCss } = await import('@/lib/theme/scheme')
    return dynamicColorCss(selector, seed, { contrast })
}

export function isImageFile(file: File | null | undefined): file is File {
    return Boolean(
        file && (file.type.startsWith('image/') || /\.(heic|heif|avif|jpe?g|png|webp|gif)$/i.test(file.name)),
    )
}
