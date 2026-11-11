// Procedural food photos for the sample recipes: each dish is drawn as SVG so the demo
// library and the starter recipes look like real clipped recipes with no assets to ship.

// ---------------------------------------------------------------- illustration

const W = 1200
const H = 900

type Rng = () => number

function makeRng(seed: string): Rng {
    let h = 2166136261
    for (const ch of seed) {
        h ^= ch.codePointAt(0) ?? 0
        h = Math.imul(h, 16777619)
    }
    let a = h >>> 0
    return () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

const f = (n: number) => Math.round(n * 10) / 10

function hexToRgb(hex: string): [number, number, number] {
    const n = Number.parseInt(hex.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix(a: string, b: string, t: number): string {
    const [r1, g1, b1] = hexToRgb(a)
    const [r2, g2, b2] = hexToRgb(b)
    const c = (x: number, y: number) =>
        Math.round(x + (y - x) * t)
            .toString(16)
            .padStart(2, '0')
    return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`
}

const lighten = (c: string, t: number) => mix(c, '#ffffff', t)
const darken = (c: string, t: number) => mix(c, '#000000', t)

type Stop = string | [color: string, opacity: number]
type Pt = [number, number]

function smoothClosed(pts: Pt[]): string {
    const at = (i: number) => pts[(i + pts.length) % pts.length] as Pt
    let d = `M${f(at(0)[0])} ${f(at(0)[1])}`
    for (let i = 0; i < pts.length; i++) {
        const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
        d += `C${f(c1[0] as number)} ${f(c1[1] as number)} ${f(c2[0] as number)} ${f(c2[1] as number)} ${f(p2[0])} ${f(p2[1])}`
    }
    return `${d}Z`
}

class Canvas {
    private readonly defs: string[] = []
    private readonly parts: string[] = []
    private readonly grads = new Map<string, string>()
    private n = 0

    constructor(readonly rng: Rng) {}

    rand(a: number, b: number): number {
        return a + this.rng() * (b - a)
    }

    pick<T>(xs: readonly T[]): T {
        return xs[Math.floor(this.rng() * xs.length)] as T
    }

    add(svg: string): void {
        this.parts.push(svg)
    }

    private id(prefix: string): string {
        this.n += 1
        return `${prefix}${this.n}`
    }

    private stops(list: Stop[]): string {
        return list
            .map((s, i) => {
                const [color, opacity] = typeof s === 'string' ? [s, 1] : s
                const offset = list.length === 1 ? 0 : i / (list.length - 1)
                return `<stop offset="${f(offset * 100)}%" stop-color="${color}" stop-opacity="${opacity}"/>`
            })
            .join('')
    }

    radial(list: Stop[], fx = 0.5, fy = 0.5): string {
        const key = `r${JSON.stringify(list)}${fx}${fy}`
        let id = this.grads.get(key)
        if (!id) {
            id = this.id('g')
            this.grads.set(key, id)
            this.defs.push(`<radialGradient id="${id}" fx="${fx}" fy="${fy}">${this.stops(list)}</radialGradient>`)
        }
        return `url(#${id})`
    }

    linear(list: Stop[], x2 = 1, y2 = 1): string {
        const key = `l${JSON.stringify(list)}${x2}${y2}`
        let id = this.grads.get(key)
        if (!id) {
            id = this.id('g')
            this.grads.set(key, id)
            this.defs.push(
                `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${this.stops(list)}</linearGradient>`,
            )
        }
        return `url(#${id})`
    }

    clipCircle(cx: number, cy: number, r: number): string {
        const id = this.id('c')
        this.defs.push(`<clipPath id="${id}"><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/></clipPath>`)
        return `url(#${id})`
    }

    blobPath(cx: number, cy: number, rx: number, ry = rx, wobble = 0.12, points = 9): string {
        const pts: Pt[] = []
        const turn = this.rand(0, Math.PI * 2)
        for (let i = 0; i < points; i++) {
            const a = turn + (i / points) * Math.PI * 2 + this.rand(-0.15, 0.15)
            const k = 1 + this.rand(-wobble, wobble)
            pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
        }
        return smoothClosed(pts)
    }

    /** Uniform points in a disk, keeping a minimum distance when it can. */
    scatter(cx: number, cy: number, radius: number, count: number, spacing = 0): Pt[] {
        const out: Pt[] = []
        for (let i = 0; i < count; i++) {
            let best: Pt = [cx, cy]
            for (let tries = 0; tries < 30; tries++) {
                const a = this.rand(0, Math.PI * 2)
                const r = Math.sqrt(this.rng()) * radius
                best = [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
                if (out.every(([x, y]) => Math.hypot(x - best[0], y - best[1]) >= spacing)) break
            }
            out.push(best)
        }
        return out
    }

    toString(): string {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2"/></filter>
<filter id="b3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="b8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/></filter>
${this.defs.join('\n')}</defs>${this.parts.join('\n')}</svg>`
    }
}

// ---- surfaces and tableware

type TableKind = 'linen' | 'wood' | 'marble' | 'slate'

function table(c: Canvas, kind: TableKind, light: string, dark: string): void {
    c.add(`<rect width="${W}" height="${H}" fill="${c.linear([light, dark], 1, 1)}"/>`)
    if (kind === 'wood') {
        for (let y = c.rand(-60, 0); y < H; y += 190) {
            c.add(`<rect x="0" y="${f(y)}" width="${W}" height="3" fill="#000" opacity="0.22"/>`)
        }
        for (let i = 0; i < 46; i++) {
            const y = c.rand(0, H)
            const amp = c.rand(2, 8)
            const tone = c.rng() < 0.5 ? lighten(light, 0.25) : darken(dark, 0.25)
            c.add(
                `<path d="M0 ${f(y)} C300 ${f(y - amp)} 600 ${f(y + amp)} 900 ${f(y - amp / 2)} S1150 ${f(y + amp)} 1200 ${f(y)}" fill="none" stroke="${tone}" stroke-width="${f(c.rand(1, 3))}" opacity="0.18"/>`,
            )
        }
    }
    if (kind === 'marble') {
        for (let i = 0; i < 7; i++) {
            const x = c.rand(-200, W)
            const y = c.rand(-100, H)
            c.add(
                `<path d="M${f(x)} ${f(y)} c${f(c.rand(80, 200))} ${f(c.rand(40, 120))} ${f(c.rand(150, 300))} ${f(c.rand(-60, 60))} ${f(c.rand(300, 520))} ${f(c.rand(80, 260))}" fill="none" stroke="#8d8a86" stroke-width="${f(c.rand(1, 4))}" opacity="${f(c.rand(0.12, 0.3))}" filter="url(#b3)"/>`,
            )
        }
    }
    c.add(`<rect width="${W}" height="${H}" filter="url(#grain)" opacity="${kind === 'linen' ? 0.13 : 0.08}"/>`)
}

function vignette(c: Canvas): void {
    c.add(
        `<rect width="${W}" height="${H}" fill="${c.radial([
            ['#000000', 0],
            ['#000000', 0],
            ['#000000', 0.26],
        ])}"/>`,
    )
}

function napkin(c: Canvas, x: number, y: number, w: number, h: number, angle: number, color: string, stripe: string) {
    const t = `transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})"`
    c.add(`<rect ${t} x="8" y="14" width="${w}" height="${h}" rx="6" fill="#000" opacity="0.22" filter="url(#b8)"/>`)
    c.add(`<rect ${t} width="${w}" height="${h}" rx="6" fill="${c.linear([lighten(color, 0.15), color], 0, 1)}"/>`)
    c.add(`<rect ${t} y="${f(h * 0.12)}" width="${w}" height="10" fill="${stripe}" opacity="0.85"/>`)
    c.add(`<rect ${t} y="${f(h * 0.12 + 18)}" width="${w}" height="4" fill="${stripe}" opacity="0.85"/>`)
    c.add(`<rect ${t} x="${f(w * 0.5)}" width="3" height="${h}" fill="#000" opacity="0.06" filter="url(#b3)"/>`)
}

function spoon(c: Canvas, x: number, y: number, angle: number, kind: 'spoon' | 'fork' = 'spoon'): void {
    const t = `transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)}) scale(1.25)"`
    const metal = c.linear(['#eef1f3', '#a3a9ae', '#dfe3e6'], 0, 1)
    const shape =
        kind === 'spoon'
            ? `<rect x="0" y="-9" width="330" height="18" rx="9"/><ellipse cx="-60" cy="0" rx="66" ry="44"/>`
            : `<rect x="0" y="-9" width="330" height="18" rx="9"/><path d="M14 -9 C-10 -10 -30 -30 -60 -32 L-60 32 C-30 30 -10 10 14 9Z"/><rect x="-150" y="-32" width="100" height="12" rx="6"/><rect x="-150" y="-13" width="100" height="11" rx="5.5"/><rect x="-150" y="3" width="100" height="11" rx="5.5"/><rect x="-150" y="20" width="100" height="12" rx="6"/>`
    c.add(
        `<g ${t}><g transform="translate(10 16)" fill="#000" opacity="0.25" filter="url(#b8)">${shape}</g><g fill="${metal}">${shape}</g><rect x="20" y="-5" width="290" height="3" rx="1.5" fill="#fff" opacity="0.6"/></g>`,
    )
}

function chopsticks(c: Canvas, x: number, y: number, angle: number): void {
    const wood = c.linear(['#c79a63', '#9a6b3a'], 1, 0)
    for (const dy of [0, 26]) {
        c.add(
            `<g transform="translate(${f(x)} ${f(y + dy)}) rotate(${f(angle)})"><rect x="8" y="12" width="520" height="14" rx="7" fill="#000" opacity="0.25" filter="url(#b8)"/><path d="M0 0 L520 -4 L520 12 L0 8 Z" fill="${wood}"/></g>`,
        )
    }
}

function dropShadow(c: Canvas, cx: number, cy: number, r: number, ry = r): void {
    c.add(
        `<ellipse cx="${f(cx + 18)}" cy="${f(cy + 26)}" rx="${f(r)}" ry="${f(ry)}" fill="#000" opacity="0.34" filter="url(#shadow)"/>`,
    )
    c.add(
        `<ellipse cx="${f(cx + 5)}" cy="${f(cy + 8)}" rx="${f(r)}" ry="${f(ry)}" fill="#000" opacity="0.2" filter="url(#b8)"/>`,
    )
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
    const p = (a: number) => [cx + Math.cos((a * Math.PI) / 180) * r, cy + Math.sin((a * Math.PI) / 180) * r]
    const [x0, y0] = p(a0) as Pt
    const [x1, y1] = p(a1) as Pt
    return `M${f(x0)} ${f(y0)} A${f(r)} ${f(r)} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`
}

function rimLight(c: Canvas, cx: number, cy: number, r: number, width = 7, opacity = 0.75): void {
    c.add(
        `<path d="${arc(cx, cy, r, 195, 285)}" fill="none" stroke="#fff" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}" filter="url(#b3)"/>`,
    )
    c.add(
        `<path d="${arc(cx, cy, r, 20, 70)}" fill="none" stroke="#fff" stroke-width="${width * 0.6}" stroke-linecap="round" opacity="${opacity * 0.35}" filter="url(#b3)"/>`,
    )
}

/** A plate; returns the radius food should stay within. */
function plate(c: Canvas, cx: number, cy: number, r: number, glaze = '#f7f4ef', edge = '#e2ddd5'): number {
    dropShadow(c, cx, cy, r)
    c.add(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${c.radial([glaze, glaze, edge], 0.4, 0.35)}"/>`)
    c.add(
        `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r - 2}" fill="none" stroke="${darken(edge, 0.12)}" stroke-width="2" opacity="0.6"/>`,
    )
    c.add(
        `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.7)}" fill="none" stroke="#000" stroke-width="12" opacity="0.06" filter="url(#b8)"/>`,
    )
    c.add(
        `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.7 + 4)}" fill="none" stroke="#fff" stroke-width="4" opacity="0.5" filter="url(#soft)"/>`,
    )
    rimLight(c, cx, cy, r * 0.86)
    return r * 0.64
}

/** A bowl with an inner glaze; returns the inner radius (callers clip to it). */
function bowl(c: Canvas, cx: number, cy: number, r: number, outer: string, inner: string): number {
    dropShadow(c, cx, cy, r)
    c.add(
        `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${c.radial([lighten(outer, 0.15), outer, darken(outer, 0.25)], 0.4, 0.35)}"/>`,
    )
    rimLight(c, cx, cy, r * 0.94, 6, 0.6)
    const ir = r * 0.86
    c.add(
        `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(ir)}" fill="${c.radial([inner, inner, darken(inner, 0.22)], 0.55, 0.6)}"/>`,
    )
    return ir
}

function bowlInnerShade(c: Canvas, cx: number, cy: number, ir: number): void {
    c.add(
        `<circle cx="${f(cx + 6)}" cy="${f(cy + 8)}" r="${f(ir)}" fill="none" stroke="#000" stroke-width="26" opacity="0.22" filter="url(#b8)"/>`,
    )
}

function skillet(c: Canvas, cx: number, cy: number, r: number, angle: number): number {
    const iron = c.radial(['#3a3a3f', '#26262a', '#18181b'], 0.4, 0.35)
    c.add(
        `<g transform="translate(${f(cx)} ${f(cy)}) rotate(${f(angle)})"><rect x="${f(r * 0.85)}" y="-24" width="${f(r * 0.9)}" height="48" rx="20" transform="translate(14 22)" fill="#000" opacity="0.35" filter="url(#b8)"/><rect x="${f(r * 0.85)}" y="-24" width="${f(r * 0.9)}" height="48" rx="20" fill="${c.linear(['#3b3b40', '#1d1d20'], 0, 1)}"/><circle cx="${f(r * 1.6)}" cy="0" r="10" fill="#111"/></g>`,
    )
    dropShadow(c, cx, cy, r)
    c.add(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${iron}"/>`)
    c.add(
        `<path d="${arc(cx, cy, r * 0.95, 195, 290)}" fill="none" stroke="#9a9aa2" stroke-width="5" stroke-linecap="round" opacity="0.5" filter="url(#b3)"/>`,
    )
    const ir = r * 0.88
    c.add(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(ir)}" fill="#151517"/>`)
    return ir
}

function board(c: Canvas, cx: number, cy: number, w: number, h: number, angle: number, wood: string): void {
    const t = `transform="translate(${f(cx)} ${f(cy)}) rotate(${f(angle)})"`
    c.add(
        `<rect ${t} x="${f(-w / 2 + 18)}" y="${f(-h / 2 + 26)}" width="${w}" height="${h}" rx="34" fill="#000" opacity="0.4" filter="url(#shadow)"/>`,
    )
    c.add(
        `<rect ${t} x="${f(-w / 2)}" y="${f(-h / 2)}" width="${w}" height="${h}" rx="34" fill="${c.linear([lighten(wood, 0.12), wood, darken(wood, 0.15)], 1, 0.3)}"/>`,
    )
    const grain: string[] = []
    for (let i = 0; i < 26; i++) {
        const y = c.rand(-h / 2 + 20, h / 2 - 20)
        const a = c.rand(2, 7)
        grain.push(
            `<path d="M${f(-w / 2 + 20)} ${f(y)} C${f(-w / 6)} ${f(y - a)} ${f(w / 6)} ${f(y + a)} ${f(w / 2 - 20)} ${f(y)}" stroke="${c.pick([darken(wood, 0.3), lighten(wood, 0.3)])}" stroke-width="${f(c.rand(1, 2.5))}" fill="none" opacity="0.25"/>`,
        )
    }
    c.add(`<g ${t}>${grain.join('')}</g>`)
    c.add(
        `<rect ${t} x="${f(-w / 2 + 3)}" y="${f(-h / 2 + 3)}" width="${w - 6}" height="${h - 6}" rx="31" fill="none" stroke="#fff" stroke-width="3" opacity="0.25"/>`,
    )
}

function parchment(c: Canvas, cx: number, cy: number, w: number, h: number, angle: number): void {
    const t = `transform="translate(${f(cx)} ${f(cy)}) rotate(${f(angle)})"`
    c.add(
        `<rect ${t} x="${f(-w / 2 + 10)}" y="${f(-h / 2 + 16)}" width="${w}" height="${h}" fill="#000" opacity="0.25" filter="url(#b8)"/>`,
    )
    c.add(
        `<rect ${t} x="${f(-w / 2)}" y="${f(-h / 2)}" width="${w}" height="${h}" fill="${c.radial(['#f7f1e3', '#efe5cf'], 0.4, 0.4)}"/>`,
    )
    const creases: string[] = []
    for (let i = 0; i < 9; i++) {
        const x = c.rand(-w / 2, w / 2)
        const y = c.rand(-h / 2, h / 2)
        creases.push(
            `<path d="M${f(x)} ${f(y)} l${f(c.rand(-160, 160))} ${f(c.rand(-160, 160))} l${f(c.rand(-120, 120))} ${f(c.rand(-120, 120))}" stroke="${c.pick(['#fff', '#b9a77f'])}" stroke-width="2" fill="none" opacity="0.35" filter="url(#b3)"/>`,
        )
    }
    c.add(`<g ${t}>${creases.join('')}</g>`)
}

// ---- food primitives

function pool(c: Canvas, cx: number, cy: number, r: number, center: string, edge: string, wobble = 0.05): void {
    c.add(
        `<path d="${c.blobPath(cx, cy, r, r, wobble, 12)}" fill="${c.radial([center, center, edge], 0.42, 0.4)}" filter="url(#soft)"/>`,
    )
}

function sheen(c: Canvas, cx: number, cy: number, r: number, opacity = 0.18): void {
    c.add(
        `<ellipse cx="${f(cx - r * 0.3)}" cy="${f(cy - r * 0.35)}" rx="${f(r * 0.35)}" ry="${f(r * 0.18)}" transform="rotate(-30 ${f(cx - r * 0.3)} ${f(cy - r * 0.35)})" fill="#fff" opacity="${opacity}" filter="url(#b8)"/>`,
    )
}

function piece(c: Canvas, x: number, y: number, r: number, color: string, wobble = 0.22, ry = r): void {
    c.add(`<path d="${c.blobPath(x + 3, y + 4, r, ry, wobble)}" fill="#000" opacity="0.25" filter="url(#b3)"/>`)
    c.add(
        `<path d="${c.blobPath(x, y, r, ry, wobble)}" fill="${c.radial([lighten(color, 0.18), color, darken(color, 0.18)], 0.35, 0.3)}"/>`,
    )
}

function berry(c: Canvas, x: number, y: number, r: number, color: string, gloss = 0.55): void {
    c.add(
        `<circle cx="${f(x + r * 0.2)}" cy="${f(y + r * 0.3)}" r="${f(r)}" fill="#000" opacity="0.3" filter="url(#b3)"/>`,
    )
    c.add(
        `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${c.radial([lighten(color, 0.3), color, darken(color, 0.35)], 0.35, 0.3)}"/>`,
    )
    c.add(
        `<ellipse cx="${f(x - r * 0.35)}" cy="${f(y - r * 0.4)}" rx="${f(r * 0.28)}" ry="${f(r * 0.18)}" fill="#fff" opacity="${gloss}" filter="url(#soft)"/>`,
    )
}

function leaf(c: Canvas, x: number, y: number, len: number, width: number, angle: number, color: string): void {
    const d = `M${f(-len / 2)} 0 Q0 ${f(-width)} ${f(len / 2)} 0 Q0 ${f(width)} ${f(-len / 2)} 0Z`
    c.add(
        `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})"><path d="${d}" transform="translate(2 3)" fill="#000" opacity="0.25" filter="url(#b3)"/><path d="${d}" fill="${c.linear([lighten(color, 0.15), darken(color, 0.12)], 0, 1)}"/><path d="M${f(-len / 2 + 2)} 0 Q0 ${f(-width * 0.15)} ${f(len / 2 - 4)} 0" stroke="${lighten(color, 0.35)}" stroke-width="1.6" fill="none" opacity="0.7"/></g>`,
    )
}

function leaves(c: Canvas, cx: number, cy: number, r: number, count: number, size: number, colors: string[]): void {
    for (const [x, y] of c.scatter(cx, cy, r, count, size * 0.6)) {
        const len = size * c.rand(0.7, 1.2)
        leaf(c, x, y, len, len * c.rand(0.28, 0.4), c.rand(0, 360), c.pick(colors))
    }
}

function specks(c: Canvas, cx: number, cy: number, r: number, count: number, size: number, colors: string[]): void {
    const out: string[] = []
    for (const [x, y] of c.scatter(cx, cy, r, count)) {
        const s = size * c.rand(0.5, 1.3)
        out.push(
            `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(s)}" ry="${f(s * c.rand(0.4, 0.9))}" transform="rotate(${f(c.rand(0, 180))} ${f(x)} ${f(y)})" fill="${c.pick(colors)}"/>`,
        )
    }
    c.add(`<g>${out.join('')}</g>`)
}

function cube(c: Canvas, x: number, y: number, s: number, color: string): void {
    const t = `transform="translate(${f(x)} ${f(y)}) rotate(${f(c.rand(0, 90))})"`
    c.add(
        `<rect ${t} x="${f(-s / 2 + 3)}" y="${f(-s / 2 + 4)}" width="${f(s)}" height="${f(s)}" rx="${f(s * 0.22)}" fill="#000" opacity="0.25" filter="url(#b3)"/>`,
    )
    c.add(
        `<rect ${t} x="${f(-s / 2)}" y="${f(-s / 2)}" width="${f(s)}" height="${f(s)}" rx="${f(s * 0.22)}" fill="${c.linear([lighten(color, 0.25), color, darken(color, 0.15)], 1, 1)}"/>`,
    )
}

function ring(c: Canvas, x: number, y: number, r: number, outer: string, inner: string, width: number): void {
    c.add(`<circle cx="${f(x + 2)}" cy="${f(y + 3)}" r="${f(r)}" fill="#000" opacity="0.2" filter="url(#b3)"/>`)
    c.add(
        `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r - width / 2)}" fill="${inner}" stroke="${outer}" stroke-width="${f(width)}"/>`,
    )
}

function strands(
    c: Canvas,
    cx: number,
    cy: number,
    r: number,
    count: number,
    colors: string[],
    width: number,
    wave = 0.5,
): void {
    const paths: string[] = []
    for (let i = 0; i < count; i++) {
        const [x0, y0] = c.scatter(cx, cy, r * 0.9, 1)[0] as Pt
        let d = `M${f(x0)} ${f(y0)}`
        let [x, y] = [x0, y0]
        let a = c.rand(0, Math.PI * 2)
        for (let k = 0; k < 4; k++) {
            a += c.rand(-wave * 3, wave * 3)
            const len = c.rand(r * 0.25, r * 0.5)
            let nx = x + Math.cos(a) * len
            let ny = y + Math.sin(a) * len
            // Pull strays back toward the middle so pasta stays in a heap.
            if (Math.hypot(nx - cx, ny - cy) > r) {
                nx = cx + (nx - cx) * 0.6
                ny = cy + (ny - cy) * 0.6
                a += Math.PI * 0.6
            }
            const mx = (x + nx) / 2 + c.rand(-len, len) * 0.4
            const my = (y + ny) / 2 + c.rand(-len, len) * 0.4
            d += ` Q${f(mx)} ${f(my)} ${f(nx)} ${f(ny)}`
            x = nx
            y = ny
        }
        const color = c.pick(colors)
        paths.push(
            `<path d="${d}" stroke="#000" stroke-opacity="0.22" stroke-width="${f(width + 3)}" transform="translate(2 3)" fill="none" filter="url(#b3)"/>`,
            `<path d="${d}" stroke="${darken(color, 0.12)}" stroke-width="${f(width + 1)}" fill="none"/>`,
            `<path d="${d}" stroke="${color}" stroke-width="${f(width - 1)}" fill="none"/>`,
            `<path d="${d}" stroke="#fff" stroke-opacity="0.35" stroke-width="${f(width * 0.22)}" transform="translate(-1.5 -2)" fill="none"/>`,
        )
    }
    c.add(`<g stroke-linecap="round" stroke-linejoin="round">${paths.join('')}</g>`)
}

function swirl(c: Canvas, cx: number, cy: number, r: number, color: string, width: number, turns = 2.2): void {
    let d = ''
    const steps = 80
    for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const a = t * turns * Math.PI * 2
        const rr = r * (0.1 + t * 0.9) * (1 + Math.sin(t * 9) * 0.05)
        d += `${i === 0 ? 'M' : 'L'}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`
    }
    c.add(
        `<path d="${d}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round" opacity="0.92" filter="url(#soft)"/>`,
    )
}

function friedEgg(c: Canvas, x: number, y: number, r: number): void {
    c.add(`<path d="${c.blobPath(x + 3, y + 4, r, r * 0.9, 0.16, 8)}" fill="#000" opacity="0.18" filter="url(#b3)"/>`)
    c.add(
        `<path d="${c.blobPath(x, y, r, r * 0.9, 0.16, 8)}" fill="${c.radial(['#fffdf7', '#fbf6ea', '#e9dfc8'], 0.45, 0.45)}" filter="url(#soft)"/>`,
    )
    const yx = x + c.rand(-r * 0.15, r * 0.15)
    const yy = y + c.rand(-r * 0.15, r * 0.15)
    berry(c, yx, yy, r * 0.42, '#f2a21b', 0.7)
}

function halfEgg(c: Canvas, x: number, y: number, r: number, angle: number): void {
    const t = `transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})"`
    c.add(`<ellipse ${t} cx="3" cy="4" rx="${f(r)}" ry="${f(r * 0.75)}" fill="#000" opacity="0.25" filter="url(#b3)"/>`)
    c.add(`<ellipse ${t} rx="${f(r)}" ry="${f(r * 0.75)}" fill="${c.radial(['#ffffff', '#f6efe0'], 0.4, 0.4)}"/>`)
    c.add(
        `<ellipse ${t} cx="${f(r * 0.05)}" rx="${f(r * 0.5)}" ry="${f(r * 0.42)}" fill="${c.radial(['#f7a733', '#e88a1a', '#d9821e'], 0.45, 0.45)}"/>`,
    )
}

function lime(c: Canvas, x: number, y: number, r: number, angle: number, rind = '#5d9b2b', flesh = '#cfe39a'): void {
    const t = `transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})"`
    const half = `M${-r} 0 A${r} ${r} 0 0 1 ${r} 0 Z`
    const segs = [30, 60, 90, 120, 150]
        .map((a) => {
            const rad = (a * Math.PI) / 180
            return `<line x1="0" y1="0" x2="${f(-Math.cos(rad) * r * 0.8)}" y2="${f(-Math.sin(rad) * r * 0.8)}"/>`
        })
        .join('')
    c.add(
        `<g ${t}><path d="${half}" transform="translate(3 4)" fill="#000" opacity="0.25" filter="url(#b3)"/><path d="${half}" fill="${rind}"/><path d="M${f(-r * 0.86)} 0 A${f(r * 0.86)} ${f(r * 0.86)} 0 0 1 ${f(r * 0.86)} 0 Z" fill="${flesh}"/><g stroke="#f4f8e4" stroke-width="2" opacity="0.8">${segs}</g></g>`,
    )
}

function slice(c: Canvas, x: number, y: number, r: number, outer: string, inner: string, seeds?: string): void {
    ring(c, x, y, r, outer, inner, r * 0.18)
    if (!seeds) return
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        c.add(
            `<ellipse cx="${f(x + Math.cos(a) * r * 0.42)}" cy="${f(y + Math.sin(a) * r * 0.42)}" rx="${f(r * 0.1)}" ry="${f(r * 0.06)}" transform="rotate(${f((a * 180) / Math.PI)} ${f(x + Math.cos(a) * r * 0.42)} ${f(y + Math.sin(a) * r * 0.42)})" fill="${seeds}"/>`,
        )
    }
}

// ---- dishes

export type Dish =
    | 'shakshuka'
    | 'pesto'
    | 'curry'
    | 'cake'
    | 'pancakes'
    | 'sourdough'
    | 'salad'
    | 'ramen'
    | 'tacos'
    | 'tomatoSoup'
    | 'cookies'
    | 'lemonChicken'
    | 'souvlaki'
    | 'chili'
    | 'bananaBread'
    | 'gingerbread'
    | 'stirFry'

function centre(c: Canvas): Pt {
    return [600 + c.rand(-40, 40), 450 + c.rand(-20, 20)]
}

const PAINTERS: Record<Dish, (c: Canvas) => void> = {
    shakshuka(c) {
        table(c, 'slate', '#4a5059', '#2c3036')
        napkin(c, -60, 560, 420, 300, -12, '#e9dfcc', '#b5523b')
        const [cx, cy] = centre(c)
        const ir = skillet(c, cx - 40, cy, 340, -28)
        const x = cx - 40
        pool(c, x, cy, ir * 0.98, '#d4462c', '#8f2214', 0.03)
        for (const [px, py] of c.scatter(x, cy, ir * 0.9, 60)) {
            c.add(
                `<path d="${c.blobPath(px, py, c.rand(8, 22), c.rand(8, 22), 0.3, 6)}" fill="${c.pick(['#b02e1a', '#e2603f', '#c23a22', '#9d2a17'])}" opacity="0.7" filter="url(#soft)"/>`,
            )
        }
        sheen(c, x, cy, ir, 0.12)
        for (const [ex, ey] of c.scatter(x, cy, ir * 0.62, 5, ir * 0.55)) friedEgg(c, ex, ey, ir * 0.2)
        for (const [fx, fy] of c.scatter(x, cy, ir * 0.85, 14, 30)) cube(c, fx, fy, c.rand(12, 20), '#f4efe2')
        leaves(c, x, cy, ir * 0.85, 26, 26, ['#4f7a2e', '#6b9a3a', '#3f6a24'])
        specks(c, x, cy, ir * 0.9, 70, 2.6, ['#5a1a0e', '#2a1a12', '#7a2a15'])
        leaves(c, 1010, 160, 60, 5, 40, ['#4f7a2e', '#6b9a3a'])
        vignette(c)
    },
    pesto(c) {
        table(c, 'linen', '#efe6d8', '#d8cbb6')
        napkin(c, 820, -40, 420, 320, 14, '#c9d6c0', '#6c8a5a')
        const [cx, cy] = centre(c)
        const fr = plate(c, cx, cy, 350)
        pool(c, cx, cy, fr * 0.72, '#6f8a2c', '#566e22', 0.1)
        strands(c, cx, cy, fr * 0.88, 90, ['#b9be5c', '#a6b04a', '#c9c672', '#94a33f'], 12, 0.35)
        for (const [x, y] of c.scatter(cx, cy, fr * 0.8, 10, 50)) berry(c, x, y, c.rand(20, 27), '#d8392b')
        for (const [x, y] of c.scatter(cx, cy, fr * 0.8, 16)) {
            c.add(
                `<ellipse cx="${f(x)}" cy="${f(y)}" rx="9" ry="5" transform="rotate(${f(c.rand(0, 180))} ${f(x)} ${f(y)})" fill="#ecd9a6" stroke="#c9ad6e" stroke-width="1"/>`,
            )
        }
        leaves(c, cx, cy, fr * 0.7, 6, 70, ['#3f7d2c', '#4d8f34'])
        specks(c, cx, cy, fr * 0.9, 120, 3.2, ['#f6eed4', '#efe2bd', '#fffaf0'])
        spoon(c, cx + 400, cy + 120, -78, 'fork')
        vignette(c)
    },
    curry(c) {
        table(c, 'wood', '#7a5539', '#4b3221')
        const [cx, cy] = [560 + c.rand(-20, 20), 470]
        const ir = bowl(c, cx, cy, 320, '#2f6b6f', '#f2ece0')
        const clip = c.clipCircle(cx, cy, ir)
        c.add(`<g clip-path="${clip}">`)
        pool(c, cx, cy, ir * 0.97, '#eab03a', '#c27417', 0.02)
        for (const [x, y] of c.scatter(cx, cy, ir * 0.85, 18, 50)) piece(c, x, y, c.rand(22, 32), '#e0742a', 0.25)
        for (const [x, y] of c.scatter(cx, cy, ir * 0.85, 30)) berry(c, x, y, c.rand(12, 15), '#e2c07a', 0.35)
        swirl(c, cx + 20, cy - 10, ir * 0.45, '#fbf1dc', 9, 1.6)
        leaves(c, cx, cy, ir * 0.8, 18, 34, ['#3f8a3a', '#55a046'])
        specks(c, cx, cy, ir * 0.85, 30, 3, ['#b3261a', '#8a1d14'])
        bowlInnerShade(c, cx, cy, ir)
        c.add('</g>')
        const sx = 1000
        const sy = 180
        const sr = bowl(c, sx, sy, 140, '#2f6b6f', '#f2ece0')
        for (const [x, y] of c.scatter(sx, sy, sr * 0.85, 140)) {
            c.add(
                `<ellipse cx="${f(x)}" cy="${f(y)}" rx="7" ry="3.2" transform="rotate(${f(c.rand(0, 180))} ${f(x)} ${f(y)})" fill="#fbf9f3" stroke="#d9d3c5" stroke-width="0.8"/>`,
            )
        }
        lime(c, 1010, 720, 60, 160)
        vignette(c)
    },
    cake(c) {
        table(c, 'marble', '#f3f1ed', '#dcd8d1')
        const [cx, cy] = centre(c)
        plate(c, cx, cy, 380, '#fbfaf8', '#e6e2dc')
        const r = 270
        dropShadow(c, cx, cy, r * 0.98)
        c.add(
            `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${c.radial(['#5c3424', '#3a1f14', '#24130b'], 0.42, 0.38)}"/>`,
        )
        c.add(
            `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r - 10}" fill="none" stroke="#6b3f2a" stroke-width="6" opacity="0.5" filter="url(#b3)"/>`,
        )
        sheen(c, cx, cy, r, 0.22)
        for (let i = 0; i < 34; i++) {
            const a = (i / 34) * Math.PI * 2
            const rr = r * 0.82
            c.add(
                `<path d="${c.blobPath(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 16, 10, 0.3, 6)}" fill="${c.pick(['#4a2618', '#5e321f', '#3a1d11'])}"/>`,
            )
        }
        for (const [x, y] of c.scatter(cx + 30, cy - 20, 110, 11, 44)) {
            berry(c, x, y, c.rand(22, 26), '#c4284a', 0.35)
            for (let k = 0; k < 6; k++) {
                c.add(
                    `<circle cx="${f(x + c.rand(-14, 14))}" cy="${f(y + c.rand(-14, 14))}" r="3" fill="#e2557a" opacity="0.6"/>`,
                )
            }
        }
        leaves(c, cx + 10, cy - 30, 90, 4, 46, ['#4f8a3a', '#62a04a'])
        specks(c, cx, cy, r * 0.95, 160, 2.2, ['#ffffff', '#f3eee6'])
        spoon(c, cx + 420, cy + 180, -70, 'fork')
        vignette(c)
    },
    pancakes(c) {
        table(c, 'linen', '#e3eaf0', '#c7d2dc')
        napkin(c, 760, 600, 460, 340, -8, '#f6f1e6', '#5a6fa8')
        const [cx, cy] = centre(c)
        const fr = plate(c, cx, cy, 350)
        for (let i = 0; i < 4; i++) {
            const x = cx + c.rand(-10, 10)
            const y = cy + 24 - i * 9
            const r = fr * 1.02 - i * 3
            c.add(
                `<path d="${c.blobPath(x + 4, y + 10, r, r, 0.03, 12)}" fill="#000" opacity="0.2" filter="url(#b8)"/>`,
            )
            c.add(
                `<path d="${c.blobPath(x, y, r, r, 0.03, 12)}" fill="${c.radial(['#e9b968', '#d39645', '#9c6127'], 0.45, 0.4)}"/>`,
            )
        }
        for (const [x, y] of c.scatter(cx, cy - 10, fr * 0.7, 40)) {
            c.add(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(c.rand(2, 5))}" fill="#a96a2c" opacity="0.35"/>`)
        }
        c.add(
            `<path d="${c.blobPath(cx + 20, cy, fr * 0.62, fr * 0.55, 0.22, 10)}" fill="#b2621c" opacity="0.55" filter="url(#soft)"/>`,
        )
        sheen(c, cx, cy, fr, 0.3)
        cube(c, cx - 10, cy - 30, 54, '#f7e6a6')
        for (const [x, y] of c.scatter(cx, cy, fr * 1.15, 26, 34)) berry(c, x, y, c.rand(13, 17), '#3d4b8c', 0.3)
        specks(c, cx, cy, fr * 0.8, 40, 3, ['#f2d14b', '#e8c13a'])
        leaves(c, cx + 30, cy - 40, 40, 3, 34, ['#4f8a3a'])
        vignette(c)
    },
    sourdough(c) {
        table(c, 'slate', '#3a4a44', '#232d29')
        const [cx, cy] = centre(c)
        board(c, cx, cy, 940, 700, -4, '#c39563')
        const r = 290
        c.add(
            `<ellipse cx="${f(cx + 16)}" cy="${f(cy + 26)}" rx="${r}" ry="${f(r * 0.86)}" fill="#000" opacity="0.4" filter="url(#shadow)"/>`,
        )
        c.add(
            `<path d="${c.blobPath(cx, cy, r, r * 0.86, 0.04, 12)}" fill="${c.radial(['#d99d58', '#b8732f', '#7a3f17'], 0.45, 0.4)}"/>`,
        )
        for (let i = 0; i < 60; i++) {
            const [x, y] = c.scatter(cx, cy, r * 0.8, 1)[0] as Pt
            c.add(
                `<circle cx="${f(x)}" cy="${f(y)}" r="${f(c.rand(6, 20))}" fill="#5e2e10" opacity="0.08" filter="url(#b8)"/>`,
            )
        }
        const ear = `M${f(cx - r * 0.35)} ${f(cy - r * 0.62)} C${f(cx - r * 0.05)} ${f(cy - r * 0.3)} ${f(cx + r * 0.05)} ${f(cy + r * 0.25)} ${f(cx - r * 0.12)} ${f(cy + r * 0.62)}`
        c.add(
            `<path d="${ear}" stroke="#4a2008" stroke-width="34" fill="none" stroke-linecap="round" filter="url(#b3)"/>`,
        )
        c.add(
            `<path d="${ear}" stroke="#f0d3a0" stroke-width="18" fill="none" stroke-linecap="round" transform="translate(12 -2)"/>`,
        )
        c.add(
            `<path d="${ear}" stroke="#a85a22" stroke-width="10" fill="none" stroke-linecap="round" transform="translate(24 -4)" opacity="0.8" filter="url(#soft)"/>`,
        )
        for (const dx of [-0.5, 0.42]) {
            c.add(
                `<path d="M${f(cx + r * dx)} ${f(cy - r * 0.35)} q${f(r * 0.06)} ${f(r * 0.35)} 0 ${f(r * 0.7)}" stroke="#6a3410" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.7" filter="url(#soft)"/>`,
            )
        }
        specks(c, cx, cy, r * 0.95, 260, 3.5, ['#ffffff', '#f6efe3', '#efe4d2'])
        c.add(
            `<path d="${c.blobPath(cx - r * 0.2, cy - r * 0.3, r * 0.45, r * 0.3, 0.3, 9)}" fill="#fff" opacity="0.18" filter="url(#b8)"/>`,
        )
        specks(c, cx - 300, cy + 250, 80, 40, 3, ['#d29a5c', '#8a4d1f'])
        vignette(c)
    },
    salad(c) {
        table(c, 'marble', '#f2f0ec', '#d9d4cc')
        const [cx, cy] = centre(c)
        const ir = bowl(c, cx, cy, 360, '#b98b5c', '#c89b6b')
        const clip = c.clipCircle(cx, cy, ir)
        c.add(`<g clip-path="${clip}">`)
        pool(c, cx, cy, ir * 0.95, '#4f7f31', '#2f5a1d', 0.05)
        leaves(c, cx, cy, ir * 0.85, 70, 95, ['#5c9a3a', '#79b04a', '#3f7a2e', '#9cc463', '#4a8a30'])
        for (const [x, y] of c.scatter(cx, cy, ir * 0.7, 9, 60)) slice(c, x, y, 30, '#4f7c2c', '#e3edc4', '#b8c98a')
        for (const [x, y] of c.scatter(cx, cy, ir * 0.7, 8, 50)) berry(c, x, y, c.rand(20, 25), '#e0412d')
        for (const [x, y] of c.scatter(cx, cy, ir * 0.7, 12, 40)) cube(c, x, y, c.rand(16, 22), '#f6f2e8')
        for (let i = 0; i < 9; i++) {
            const [x, y] = c.scatter(cx, cy, ir * 0.75, 1)[0] as Pt
            c.add(
                `<path d="${arc(x, y, c.rand(22, 34), c.rand(0, 180), c.rand(200, 300))}" stroke="#8a3a7a" stroke-width="5" fill="none" stroke-linecap="round"/>`,
            )
        }
        specks(c, cx, cy, ir * 0.85, 60, 2.4, ['#2a2a2a', '#3a3328'])
        bowlInnerShade(c, cx, cy, ir)
        c.add('</g>')
        vignette(c)
    },
    ramen(c) {
        table(c, 'wood', '#5a3d2a', '#2f1f15')
        const [cx, cy] = [570, 460]
        const ir = bowl(c, cx, cy, 370, '#232327', '#b8392b')
        const clip = c.clipCircle(cx, cy, ir * 0.97)
        c.add(`<g clip-path="${clip}">`)
        pool(c, cx, cy, ir * 0.97, '#e3a457', '#b1692b', 0.02)
        strands(c, cx - ir * 0.2, cy + ir * 0.2, ir * 0.45, 26, ['#f2dc8e', '#ead07a'], 9, 0.8)
        for (let i = 0; i < 3; i++) {
            const x = cx + ir * 0.35 + i * 30
            const y = cy - ir * 0.2 + i * 50
            c.add(`<circle cx="${f(x + 3)}" cy="${f(y + 4)}" r="62" fill="#000" opacity="0.25" filter="url(#b3)"/>`)
            c.add(
                `<path d="${c.blobPath(x, y, 62, 58, 0.06, 10)}" fill="${c.radial(['#d7957a', '#b06a4c', '#7a3f24'], 0.45, 0.45)}" stroke="#f2d8c3" stroke-width="7"/>`,
            )
        }
        halfEgg(c, cx - ir * 0.3, cy - ir * 0.4, 62, -20)
        halfEgg(c, cx - ir * 0.05, cy - ir * 0.52, 62, 15)
        c.add(
            `<rect x="${f(cx + ir * 0.35)}" y="${f(cy - ir * 0.95)}" width="150" height="240" rx="4" transform="rotate(18 ${f(cx + ir * 0.35)} ${f(cy - ir * 0.8)})" fill="${c.linear(['#26331f', '#141c10'], 1, 1)}"/>`,
        )
        for (const [x, y] of c.scatter(cx, cy, ir * 0.75, 40, 16)) ring(c, x, y, c.rand(7, 10), '#4f9a3a', '#c9e3a0', 4)
        for (const [x, y] of c.scatter(cx, cy, ir * 0.85, 16)) {
            c.add(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(c.rand(6, 14))}" fill="#c8331c" opacity="0.45"/>`)
        }
        specks(c, cx, cy, ir * 0.75, 60, 2.6, ['#f6ecd6', '#2a2118'])
        bowlInnerShade(c, cx, cy, ir)
        c.add('</g>')
        chopsticks(c, 880, 140, 62)
        vignette(c)
    },
    tacos(c) {
        table(c, 'linen', '#e9b48f', '#c97f56')
        const [cx, cy] = centre(c)
        const fr = plate(c, cx, cy, 370, '#f4efe6', '#dcd3c4')
        for (let i = 0; i < 3; i++) {
            const y = cy - fr * 0.6 + i * fr * 0.6
            const x = cx + (i - 1) * 25
            const rx = fr * 0.95
            const ry = 70
            const t = `transform="translate(${f(x)} ${f(y)}) rotate(${f(c.rand(-6, 6))})"`
            c.add(
                `<ellipse ${t} cx="6" cy="16" rx="${f(rx)}" ry="${ry}" fill="#000" opacity="0.25" filter="url(#b8)"/>`,
            )
            c.add(
                `<ellipse ${t} rx="${f(rx)}" ry="${ry}" fill="${c.radial(['#f3d58f', '#e2b45c', '#b98336'], 0.5, 0.4)}"/>`,
            )
            const filling: string[] = []
            for (let k = 0; k < 26; k++) {
                const fx = c.rand(-rx * 0.85, rx * 0.85)
                const fy = c.rand(-ry * 0.8, -ry * 0.1)
                filling.push(
                    `<path d="${c.blobPath(fx, fy, c.rand(12, 26), c.rand(8, 16), 0.3, 6)}" fill="${c.pick(['#d99a45', '#c27a2f', '#7a3f8a', '#9b5aa8', '#f5f0e6', '#e2533b'])}"/>`,
                )
            }
            c.add(`<g ${t}>${filling.join('')}</g>`)
            c.add(
                `<g ${t}><path d="M${f(-rx)} 0 A${f(rx)} ${ry} 0 0 0 ${f(rx)} 0 Q0 ${f(ry * 0.35)} ${f(-rx)} 0Z" fill="${c.linear(['#efc678', '#d9a24d'], 0, 1)}"/><path d="M${f(-rx * 0.9)} ${f(ry * 0.1)} Q0 ${f(ry * 0.45)} ${f(rx * 0.9)} ${f(ry * 0.1)}" stroke="#fff7e0" stroke-width="10" fill="none" opacity="0.9" stroke-linecap="round"/></g>`,
            )
            for (let k = 0; k < 5; k++) {
                leaf(c, x + c.rand(-rx * 0.7, rx * 0.7), y - c.rand(10, 40), 26, 9, c.rand(0, 360), '#3f8a3a')
            }
            specks(c, x, y - 20, rx * 0.6, 20, 3, ['#b3261a', '#2a2118'])
        }
        lime(c, cx + fr * 1.15, cy + fr * 0.95, 55, -30)
        lime(c, cx - fr * 1.25, cy - fr * 0.85, 55, 140)
        vignette(c)
    },
    tomatoSoup(c) {
        table(c, 'linen', '#ece4d6', '#d3c6b0')
        napkin(c, -80, -60, 460, 360, 10, '#d8e2ea', '#c44b33')
        const [cx, cy] = centre(c)
        const ir = bowl(c, cx, cy, 330, '#f5f2ec', '#fbf9f5')
        const clip = c.clipCircle(cx, cy, ir)
        c.add(`<g clip-path="${clip}">`)
        pool(c, cx, cy, ir * 0.97, '#e0532f', '#b2301a', 0.01)
        sheen(c, cx, cy, ir, 0.15)
        swirl(c, cx - 10, cy + 10, ir * 0.42, '#fbefe0', 8, 2.4)
        for (const [x, y] of c.scatter(cx, cy, ir * 0.7, 9)) {
            c.add(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(c.rand(5, 12))}" fill="#f2c94c" opacity="0.5"/>`)
        }
        for (const [x, y] of c.scatter(cx + 60, cy - 50, ir * 0.45, 9, 40)) cube(c, x, y, c.rand(26, 32), '#d9a35a')
        leaves(c, cx - 70, cy + 60, 60, 4, 40, ['#3f7d2c', '#4d8f34'])
        specks(c, cx, cy, ir * 0.85, 50, 2.4, ['#2a1a12', '#3a2a1a'])
        bowlInnerShade(c, cx, cy, ir)
        c.add('</g>')
        spoon(c, cx + 360, cy + 150, -60)
        vignette(c)
    },
    cookies(c) {
        table(c, 'wood', '#4b3426', '#2a1c13')
        parchment(c, 600, 450, 980, 740, 3)
        for (const [x, y] of c.scatter(600, 450, 340, 9, 175)) {
            const r = c.rand(80, 92)
            c.add(
                `<path d="${c.blobPath(x + 6, y + 10, r, r, 0.06, 11)}" fill="#000" opacity="0.28" filter="url(#b8)"/>`,
            )
            c.add(
                `<path d="${c.blobPath(x, y, r, r, 0.07, 11)}" fill="${c.radial(['#e2b06b', '#cf9550', '#9c5e26'], 0.45, 0.42)}"/>`,
            )
            for (let k = 0; k < 7; k++) {
                const a = c.rand(0, Math.PI * 2)
                const rr = c.rand(0, r * 0.7)
                c.add(
                    `<path d="${c.blobPath(x + Math.cos(a) * rr, y + Math.sin(a) * rr, c.rand(9, 16), c.rand(7, 13), 0.3, 6)}" fill="${c.pick(['#3b2014', '#2c160d', '#4a2a1a'])}"/>`,
                )
            }
            for (let k = 0; k < 5; k++) {
                c.add(
                    `<path d="${arc(x, y, c.rand(r * 0.3, r * 0.8), c.rand(0, 300), c.rand(310, 360))}" stroke="#8a5222" stroke-width="2" fill="none" opacity="0.35"/>`,
                )
            }
            specks(c, x, y, r * 0.7, 8, 2.6, ['#ffffff'])
        }
        specks(c, 600, 450, 420, 40, 4, ['#c58a48', '#3b2014'])
        vignette(c)
    },
    lemonChicken(c) {
        table(c, 'slate', '#4f5960', '#30373c')
        const [cx, cy] = centre(c)
        const fr = plate(c, cx, cy, 360, '#f1ece2', '#d8cfc0')
        pool(c, cx, cy, fr * 0.95, '#d9b77a', '#b98a45', 0.12)
        for (const [x, y] of c.scatter(cx, cy, fr * 0.9, 26, 50)) piece(c, x, y, c.rand(30, 40), '#e2b04f', 0.3)
        for (const [x, y] of c.scatter(cx, cy, fr * 0.55, 4, 120)) {
            piece(c, x, y, c.rand(88, 100), '#cf8e3a', 0.15, c.rand(62, 72))
            specks(c, x, y, 55, 14, 5, ['#6a3410', '#4a230b'])
            sheen(c, x, y, 80, 0.25)
        }
        for (const [x, y] of c.scatter(cx, cy, fr * 0.8, 4, 120)) slice(c, x, y, 38, '#f3c623', '#fbeea0', '#f6dc6a')
        for (let i = 0; i < 4; i++) {
            const [x, y] = c.scatter(cx, cy, fr * 0.7, 1)[0] as Pt
            const a = c.rand(0, 360)
            for (let k = -3; k <= 3; k++) {
                const rad = (a * Math.PI) / 180
                leaf(
                    c,
                    x + Math.cos(rad) * k * 12,
                    y + Math.sin(rad) * k * 12,
                    26,
                    4,
                    a + (k % 2 === 0 ? 40 : -40),
                    '#3d5c34',
                )
            }
        }
        specks(c, cx, cy, fr * 0.9, 50, 2.6, ['#2a1a12', '#ffffff'])
        spoon(c, cx - 420, cy + 60, -96, 'fork')
        vignette(c)
    },
    souvlaki(c) {
        table(c, 'wood', '#b48a5f', '#82593a')
        const [cx, cy] = centre(c)
        const fr = plate(c, cx, cy, 380, '#f7f3ec', '#ddd5c8')
        for (let i = 0; i < 3; i++) {
            const y = cy - fr * 0.55 + i * fr * 0.55
            const angle = c.rand(-14, -6)
            const t = `transform="translate(${f(cx)} ${f(y)}) rotate(${f(angle)})"`
            c.add(
                `<g ${t}><rect x="${f(-fr * 1.4)}" y="-4" width="${f(fr * 2.8)}" height="8" rx="4" fill="#d9b98a"/></g>`,
            )
            const pieces: string[] = []
            for (let k = 0; k < 7; k++) {
                const x = -fr * 0.9 + k * fr * 0.3
                const color = k % 3 === 1 ? c.pick(['#c93a2a', '#4f8a3a']) : '#d49a48'
                pieces.push(
                    `<path d="${c.blobPath(x + 3, 5, 30, 34, 0.18, 7)}" fill="#000" opacity="0.25" filter="url(#b3)"/><path d="${c.blobPath(x, 0, 30, 34, 0.18, 7)}" fill="${c.radial([lighten(color, 0.2), color, darken(color, 0.25)], 0.4, 0.35)}"/>`,
                )
            }
            c.add(`<g ${t}>${pieces.join('')}</g>`)
            specks(c, cx, y, fr * 0.8, 25, 3, ['#5a2a0e', '#3a5a2a'])
        }
        const ir = bowl(c, cx + fr * 1.2, cy - fr * 0.95, 120, '#f2efe8', '#fbf9f5')
        pool(c, cx + fr * 1.2, cy - fr * 0.95, ir * 0.9, '#f6f3ea', '#e5dfd0', 0.05)
        specks(c, cx + fr * 1.2, cy - fr * 0.95, ir * 0.7, 40, 3, ['#5c8a3a', '#7aa84f'])
        lime(c, cx - fr * 1.2, cy + fr * 1.0, 60, 200, '#f1c524', '#fbeea0')
        vignette(c)
    },
    chili(c) {
        table(c, 'wood', '#6e4b33', '#3e281a')
        napkin(c, 760, 560, 480, 360, -14, '#e7e1d4', '#2f5a7a')
        const [cx, cy] = centre(c)
        const ir = bowl(c, cx, cy, 340, '#c45a2a', '#e9e0cf')
        const clip = c.clipCircle(cx, cy, ir)
        c.add(`<g clip-path="${clip}">`)
        pool(c, cx, cy, ir * 0.97, '#8f3a1c', '#5a2010', 0.02)
        for (const [x, y] of c.scatter(cx, cy, ir * 0.9, 70)) {
            c.add(
                `<path d="${c.blobPath(x, y, c.rand(8, 18), c.rand(8, 14), 0.3, 6)}" fill="${c.pick(['#6d2a14', '#a5482a', '#7a3a20'])}" opacity="0.8"/>`,
            )
        }
        for (const [x, y] of c.scatter(cx, cy, ir * 0.85, 26)) piece(c, x, y, 13, '#5e1e1a', 0.15, 9)
        c.add(
            `<path d="${c.blobPath(cx + 15, cy - 10, 80, 70, 0.18, 9)}" fill="${c.radial(['#ffffff', '#f7f3ea', '#e4dccb'], 0.4, 0.4)}" filter="url(#soft)"/>`,
        )
        strands(c, cx - 70, cy + 40, 110, 22, ['#f0a030', '#e8902a'], 5, 0.2)
        for (const [x, y] of c.scatter(cx, cy, ir * 0.7, 30, 16)) ring(c, x, y, c.rand(7, 9), '#4f9a3a', '#c9e3a0', 4)
        bowlInnerShade(c, cx, cy, ir)
        c.add('</g>')
        for (const [x, y] of c.scatter(170, 200, 110, 5, 70)) {
            c.add(
                `<path d="M${f(x)} ${f(y - 44)} L${f(x + 46)} ${f(y + 34)} L${f(x - 46)} ${f(y + 34)}Z" transform="rotate(${f(c.rand(0, 120))} ${f(x)} ${f(y)})" fill="${c.linear(['#f2cf7a', '#d9a344'], 1, 1)}" stroke="#c98f32" stroke-width="2" stroke-linejoin="round"/>`,
            )
        }
        vignette(c)
    },
    bananaBread(c) {
        table(c, 'linen', '#ebe3d3', '#cfc1a8')
        const [cx, cy] = centre(c)
        board(c, cx, cy, 980, 560, 6, '#b88a58')
        for (let i = 0; i < 4; i++) {
            const x = cx - 270 + i * 150
            const y = cy + c.rand(-20, 20)
            const t = `transform="translate(${f(x)} ${f(y)}) rotate(${f(-8 + i * 5)})"`
            c.add(
                `<rect ${t} x="-62" y="-150" width="150" height="320" rx="34" fill="#000" opacity="0.3" filter="url(#b8)"/>`,
            )
            c.add(
                `<rect ${t} x="-75" y="-160" width="150" height="320" rx="34" fill="${c.radial(['#d8a86a', '#c4904f', '#ad7738'], 0.5, 0.5)}" stroke="#5a3218" stroke-width="12"/>`,
            )
            c.add(
                `<path ${t} d="M-55 ${f(c.rand(-20, 20))} C-25 ${f(c.rand(-40, -10))} 5 ${f(c.rand(10, 40))} 55 ${f(c.rand(-15, 15))}" stroke="#8a4a1e" stroke-width="9" fill="none" opacity="0.45" filter="url(#b3)"/>`,
            )
            const holes: string[] = []
            for (let k = 0; k < 30; k++) {
                holes.push(
                    `<circle cx="${f(c.rand(-60, 60))}" cy="${f(c.rand(-140, 140))}" r="${f(c.rand(1.5, 4))}" fill="#8a5a2a" opacity="0.4"/>`,
                )
            }
            c.add(`<g ${t}>${holes.join('')}</g>`)
            specks(c, x, y - 160, 50, 20, 3, ['#f5e2b0', '#d9b46a'])
        }
        specks(c, cx, cy + 200, 300, 40, 4, ['#c4904f', '#5a3218'])
        vignette(c)
    },
    gingerbread(c) {
        table(c, 'slate', '#5a3f3a', '#2e2220')
        parchment(c, 600, 450, 1000, 760, -3)
        const spots = c.scatter(600, 450, 320, 6, 210)
        for (const [x, y] of spots) {
            const t = `transform="translate(${f(x)} ${f(y)}) rotate(${f(c.rand(-30, 30))})"`
            const body =
                '<circle cx="0" cy="-70" r="40"/><path d="M0 -20 L-80 -10 M0 -20 L80 -10 M0 -20 L0 30 M0 30 L-46 100 M0 30 L46 100" stroke-width="54" stroke-linecap="round" stroke-linejoin="round" fill="none"/><ellipse cx="0" cy="10" rx="40" ry="52"/>'
            c.add(
                `<g ${t}><g transform="translate(6 10)" fill="#000" stroke="#000" opacity="0.3" filter="url(#b8)">${body}</g><g fill="#b4693a" stroke="#b4693a">${body}</g><g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"><path d="M-92 -24 q6 8 0 16 q-6 8 0 16"/><path d="M92 -24 q-6 8 0 16 q6 8 0 16"/><path d="M-62 100 l20 10"/><path d="M62 100 l-20 10"/><path d="M-16 -56 q16 14 32 0"/></g><g fill="#fff"><circle cx="-13" cy="-78" r="5"/><circle cx="13" cy="-78" r="5"/><circle cx="0" cy="0" r="6"/><circle cx="0" cy="24" r="6"/></g><g fill="#c43a3a"><circle cx="0" cy="-12" r="6"/></g></g>`,
            )
        }
        for (const [x, y] of c.scatter(600, 450, 460, 7, 120)) {
            if (spots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 140)) continue
            c.add(
                `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(c.rand(0, 72))})"><path d="M0 -40 L11 -14 L38 -12 L17 6 L24 34 L0 19 L-24 34 L-17 6 L-38 -12 L-11 -14Z" fill="#000" opacity="0.25" filter="url(#b3)" transform="translate(3 5)"/><path d="M0 -40 L11 -14 L38 -12 L17 6 L24 34 L0 19 L-24 34 L-17 6 L-38 -12 L-11 -14Z" fill="#c07a44" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></g>`,
            )
        }
        specks(c, 600, 450, 450, 50, 3, ['#ffffff', '#b4693a'])
        vignette(c)
    },
    stirFry(c) {
        table(c, 'linen', '#e8e2d8', '#cdc3b3')
        const [cx, cy] = centre(c)
        const ir = skillet(c, cx - 30, cy, 350, 200)
        const x = cx - 30
        pool(c, x, cy, ir * 0.9, '#7a4a1f', '#3b220d', 0.08)
        for (const [px, py] of c.scatter(x, cy, ir * 0.8, 14, 60)) {
            for (let k = 0; k < 6; k++) {
                berry(
                    c,
                    px + c.rand(-18, 18),
                    py + c.rand(-18, 18),
                    c.rand(12, 17),
                    c.pick(['#3f7d2c', '#4a8f34']),
                    0.2,
                )
            }
        }
        for (const [px, py] of c.scatter(x, cy, ir * 0.8, 16, 40)) cube(c, px, py, c.rand(36, 44), '#e6b866')
        for (let i = 0; i < 14; i++) {
            const [px, py] = c.scatter(x, cy, ir * 0.8, 1)[0] as Pt
            c.add(
                `<path d="${arc(px, py, c.rand(40, 60), c.rand(0, 200), c.rand(220, 260))}" stroke="${c.pick(['#d8352a', '#e8a33a'])}" stroke-width="12" stroke-linecap="round" fill="none"/>`,
            )
        }
        sheen(c, x, cy, ir, 0.2)
        specks(c, x, cy, ir * 0.85, 120, 2.6, ['#f6ecd6', '#1e1a16'])
        for (const [px, py] of c.scatter(x, cy, ir * 0.7, 24, 14)) ring(c, px, py, 8, '#4f9a3a', '#c9e3a0', 4)
        chopsticks(c, 820, 700, -20)
        vignette(c)
    },
}

export function drawDish(dish: Dish, seed: string): string {
    const c = new Canvas(makeRng(seed))
    PAINTERS[dish](c)
    return c.toString()
}
