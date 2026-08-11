export type { ExportFormat, ExportOptions, ExportResult, Exporter } from './types'
export { pngExporter } from './PngExporter'
export { jpegExporter } from './JpegExporter'
export { htmlExporter } from './HtmlExporter'
export { pptxExporter } from './PptxExporter'

import type { ExportFormat, Exporter } from './types'
import { pngExporter } from './PngExporter'
import { jpegExporter } from './JpegExporter'
import { htmlExporter } from './HtmlExporter'
import { pptxExporter } from './PptxExporter'

const exporterRegistry = new Map<ExportFormat, Exporter>([
  ['png', pngExporter],
  ['jpeg', jpegExporter],
  ['html', htmlExporter],
  ['pptx', pptxExporter],
])

export function getExporter(format: ExportFormat): Exporter | undefined {
  return exporterRegistry.get(format)
}

export function getAvailableFormats(): ExportFormat[] {
  return Array.from(exporterRegistry.keys())
}
