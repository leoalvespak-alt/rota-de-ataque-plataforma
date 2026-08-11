import { toJpeg } from 'html-to-image'
import type { Exporter, ExportOptions, ExportResult } from './types'

export const jpegExporter: Exporter = {
  format: 'jpeg',
  label: 'JPEG',

  async export(element: HTMLElement, options: ExportOptions): Promise<ExportResult> {
    const scale = options.scale ?? 2
    const quality = options.quality ?? 0.92
    const dataUrl = await toJpeg(element, {
      width: options.width,
      height: options.height,
      pixelRatio: scale,
      quality,
      cacheBust: true,
    })

    const response = await fetch(dataUrl)
    const blob = await response.blob()
    const filename = options.filename ?? `rota-de-ataque-${Date.now()}.jpg`

    return { blob, filename, format: 'jpeg', size: blob.size }
  },
}
