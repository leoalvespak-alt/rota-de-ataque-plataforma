import sharp from 'sharp'
import type { Sharp } from 'sharp'

export interface ProcessOptions {
  width?: number
  height?: number
  format?: 'png' | 'jpeg' | 'webp' | 'avif'
  quality?: number
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
}

export interface CropOptions {
  left: number
  top: number
  width: number
  height: number
}

export interface BrandVariation {
  type: 'duotone' | 'monochrome' | 'high-contrast' | 'editorial' | 'dark'
}

export async function processImage(
  input: Buffer,
  options: ProcessOptions,
): Promise<Buffer> {
  let pipeline: Sharp = sharp(input)

  if (options.width ?? options.height) {
    pipeline = pipeline.resize(options.width, options.height, {
      fit: options.fit ?? 'cover',
      withoutEnlargement: true,
    })
  }

  const format = options.format ?? 'png'
  const quality = options.quality ?? 85

  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true })
      break
    case 'webp':
      pipeline = pipeline.webp({ quality })
      break
    case 'avif':
      pipeline = pipeline.avif({ quality })
      break
    default:
      pipeline = pipeline.png({ compressionLevel: 9 })
  }

  return pipeline.toBuffer()
}

export async function cropImage(input: Buffer, crop: CropOptions): Promise<Buffer> {
  return sharp(input)
    .extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
    .toBuffer()
}

export async function createThumbnail(
  input: Buffer,
  size: number = 200,
): Promise<Buffer> {
  return sharp(input)
    .resize(size, size, { fit: 'cover' })
    .jpeg({ quality: 70, mozjpeg: true })
    .toBuffer()
}

export async function applyBrandVariation(
  input: Buffer,
  variation: BrandVariation,
): Promise<Buffer> {
  let pipeline = sharp(input)

  switch (variation.type) {
    case 'monochrome':
      pipeline = pipeline.grayscale()
      break
    case 'high-contrast':
      pipeline = pipeline.linear(1.5, -(128 * 0.5))
      break
    case 'duotone':
      pipeline = pipeline
        .grayscale()
        .tint({ r: 193, g: 18, b: 31 })
      break
    case 'editorial':
      pipeline = pipeline
        .modulate({ brightness: 0.95, saturation: 0.7 })
        .sharpen()
      break
    case 'dark':
      pipeline = pipeline
        .modulate({ brightness: 0.6, saturation: 0.8 })
      break
  }

  return pipeline.toBuffer()
}

export async function getImageMetadata(input: Buffer) {
  const metadata = await sharp(input).metadata()
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    format: metadata.format,
    size: input.length,
    hasAlpha: metadata.hasAlpha ?? false,
  }
}

export async function validateImageForExport(
  input: Buffer,
  minWidth: number = 1080,
  minHeight: number = 1080,
): Promise<{ valid: boolean; reason?: string }> {
  const meta = await getImageMetadata(input)
  if (meta.width < minWidth || meta.height < minHeight) {
    return {
      valid: false,
      reason: `Imagem ${meta.width}x${meta.height} abaixo do minimo ${minWidth}x${minHeight}`,
    }
  }
  return { valid: true }
}
