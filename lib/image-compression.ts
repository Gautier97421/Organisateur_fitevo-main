import sharp from 'sharp'
import logger from './logger'

const COMPRESSIBLE_MIMES = new Set<string>([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

const MAX_DIMENSION = 2048
const JPEG_QUALITY = 85
const WEBP_QUALITY = 85
const PNG_COMPRESSION = 9

export interface CompressionResult {
  buffer: Buffer
  mimeType: string
  size: number
  compressed: boolean
}

/**
 * Compresse une image si possible (JPEG/PNG/WebP).
 * - Resize à 2048px max sur la plus grande dimension (sans agrandir).
 * - Réencode avec une qualité raisonnable.
 * - Préserve le mime-type d'origine quand pertinent.
 * - Si le résultat est plus gros que l'original, on garde l'original.
 * - GIF et autres formats ne sont pas touchés.
 */
export async function compressImageIfPossible(
  input: Buffer,
  mimeType: string,
): Promise<CompressionResult> {
  const original: CompressionResult = {
    buffer: input,
    mimeType,
    size: input.length,
    compressed: false,
  }

  if (!COMPRESSIBLE_MIMES.has(mimeType)) {
    return original
  }

  try {
    const pipeline = sharp(input, { failOn: 'none' })
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })

    let outBuffer: Buffer
    let outMime = mimeType

    if (mimeType === 'image/png') {
      // Lossless: zéro perte visuelle, gain via deflate max + resize.
      outBuffer = await pipeline.png({ compressionLevel: PNG_COMPRESSION }).toBuffer()
    } else if (mimeType === 'image/webp') {
      outBuffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer()
    } else {
      outBuffer = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer()
      outMime = 'image/jpeg'
    }

    if (outBuffer.length >= input.length) {
      // La compression n'apporte rien : on garde l'original.
      return original
    }

    return {
      buffer: outBuffer,
      mimeType: outMime,
      size: outBuffer.length,
      compressed: true,
    }
  } catch (error) {
    logger.warn('Compression image échouée, fichier original conservé', error)
    return original
  }
}
