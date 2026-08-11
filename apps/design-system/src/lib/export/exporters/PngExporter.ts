import { toPng } from 'html-to-image'
import type { Exporter, ExportOptions, ExportResult } from './types'

export const pngExporter: Exporter = {
  format: 'png',
  label: 'PNG',

  async export(element: HTMLElement, options: ExportOptions): Promise<ExportResult> {
    const scale = options.scale ?? 2
    const dataUrl = await toPng(element, {
      width: options.width,
      height: options.height,
      pixelRatio: scale,
      cacheBust: true,
    })

    const response = await fetch(dataUrl)
    const blob = await response.blob()
    const filename = options.filename ?? `rota-de-ataque-${Date.now()}.png`

    return { blob, filename, format: 'png', size: blob.size }
  },
}
