import 'server-only'

import QRCode from 'qrcode'

export interface QrOptions {
    /** Paint dark modules with currentColor so CSS can theme them. Keep contrast high for scanning. */
    currentColor?: boolean
    /** Drop the white background square (the caller provides a light surface). */
    transparent?: boolean
    margin?: number
}

/**
 * An inline SVG QR code. Rendered on the server so the display needs no client
 * library and no extra CSP allowance (it is plain markup, not an image fetch).
 */
export async function renderQrSvg(text: string, opts: QrOptions = {}): Promise<string> {
    let svg = await QRCode.toString(text, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: opts.margin ?? 2,
        color: { dark: '#000000', light: '#ffffff' },
    })
    if (opts.currentColor) svg = svg.replace(/stroke="#000000"/g, 'stroke="currentColor"')
    if (opts.transparent) svg = svg.replace(/<path fill="#ffffff"[^>]*\/>/, '')
    return svg.replace('<svg ', '<svg role="img" aria-label="QR code" ').trim()
}
