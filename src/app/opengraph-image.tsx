import { ImageResponse } from 'next/og'
import { SHAPE_PATHS } from '@/components/ui/shape/shape-paths'

export const alt = 'ClipCook. Save recipes from any website and cook them step by step.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// The sign-in screen's table of shapes, in the brand's food colors.
const SHAPES: { name: keyof typeof SHAPE_PATHS; color: string; size: number; x: number; y: number; rotate?: number }[] =
    [
        { name: 'cookie9', color: '#FF7D53', size: 330, x: 70, y: 150 },
        { name: 'circle', color: '#FFBE3D', size: 130, x: 300, y: 92 },
        { name: 'clover4', color: '#8FC48B', size: 200, x: 400, y: 260, rotate: 12 },
        { name: 'sunny', color: '#FFDB98', size: 180, x: 40, y: 380 },
        { name: 'pill', color: '#FFDBD0', size: 170, x: 300, y: 420, rotate: -28 },
        { name: 'cookie4', color: '#D9818F', size: 96, x: 470, y: 70, rotate: 18 },
    ]

function shapeUri(path: string, color: string) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${path}" fill="${color}"/></svg>`
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export default function OpenGraphImage() {
    return new ImageResponse(
        <div style={{ display: 'flex', width: '100%', height: '100%', background: '#FFF8F6', position: 'relative' }}>
            {SHAPES.map((s) => (
                // biome-ignore lint/performance/noImgElement: Satori renders plain img elements
                <img
                    key={s.name}
                    alt=""
                    src={shapeUri(SHAPE_PATHS[s.name], s.color)}
                    width={s.size}
                    height={s.size}
                    style={{
                        position: 'absolute',
                        left: s.x,
                        top: s.y,
                        transform: `rotate(${s.rotate ?? 0}deg)`,
                    }}
                />
            ))}
            <div
                style={{
                    position: 'absolute',
                    left: 660,
                    top: 0,
                    bottom: 0,
                    right: 64,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 20,
                    color: '#3E2F2B',
                }}
            >
                <div style={{ fontSize: 116, fontWeight: 600, letterSpacing: -3 }}>ClipCook</div>
                <div style={{ fontSize: 38, lineHeight: 1.3, color: '#6B5852' }}>
                    Save recipes from any website and cook them step by step.
                </div>
            </div>
        </div>,
        size,
    )
}
