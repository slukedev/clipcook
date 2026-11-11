// Pre-renders the starter recipes' drawn photos to WebP. Rasterizing the SVG drawings
// takes about two seconds each, too slow for someone's first tap on an empty library.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { drawDish } from '../src/server/starter/dishes'
import { STARTER_RECIPES } from '../src/server/starter/index'

const OUT = path.join(process.cwd(), 'src/server/starter/photos')

async function main() {
    await mkdir(OUT, { recursive: true })
    for (const recipe of STARTER_RECIPES) {
        if (!recipe.dish) continue
        const webp = await sharp(Buffer.from(drawDish(recipe.dish, recipe.key)))
            .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer()
        await writeFile(path.join(OUT, `${recipe.key}.webp`), webp)
        console.log(`${recipe.key}.webp ${Math.round(webp.length / 1024)} KB`)
    }
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
