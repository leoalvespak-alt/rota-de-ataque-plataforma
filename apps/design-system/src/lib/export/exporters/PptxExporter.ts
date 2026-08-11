import PptxGenJS from 'pptxgenjs'
import { toPng } from 'html-to-image'
import type { Exporter, ExportOptions, ExportResult } from './types'

export const pptxExporter: Exporter = {
  format: 'pptx',
  label: 'PowerPoint',

  async export(element: HTMLElement, options: ExportOptions): Promise<ExportResult> {
    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_WIDE'
    pptx.author = 'Rota de Ataque'

    const dataUrl = await toPng(element, {
      width: options.width,
      height: options.height,
      pixelRatio: 2,
      cacheBust: true,
    })

    const slide = pptx.addSlide()
    slide.background = { color: '0A0A0A' }
    slide.addImage({
      data: dataUrl,
      x: 0,
      y: 0,
      w: '100%',
      h: '100%',
    })

    const arrayBuffer = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer
    const blob = new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    })
    const filename = options.filename ?? `rota-de-ataque-${Date.now()}.pptx`

    return { blob, filename, format: 'pptx', size: blob.size }
  },
}
