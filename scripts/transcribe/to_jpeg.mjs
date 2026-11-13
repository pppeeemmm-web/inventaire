// Any image the app stores (AVIF included — some grid AVIFs defeat ffmpeg) -> upright JPEG,
// long side <= 1600. Uses the app's own sharp. Usage: node to_jpeg.mjs <src> <dest>
import sharp from 'sharp'

const [src, dest] = process.argv.slice(2)
if (!src || !dest) {
  console.error('usage: node to_jpeg.mjs <src> <dest>')
  process.exit(2)
}
await sharp(src).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(dest)
