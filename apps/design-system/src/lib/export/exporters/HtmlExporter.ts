import type { Exporter, ExportOptions, ExportResult } from './types'

export const htmlExporter: Exporter = {
  format: 'html',
  label: 'HTML Standalone',

  async export(element: HTMLElement, options: ExportOptions): Promise<ExportResult> {
    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules).map((r) => r.cssText).join('\n')
        } catch {
          return ''
        }
      })
      .join('\n')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${options.width}">
  <title>Rota de Ataque — Criativo</title>
  <style>${styles}</style>
</head>
<body style="margin:0;padding:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#111">
  ${element.outerHTML}
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const filename = options.filename ?? `rota-de-ataque-${Date.now()}.html`

    return { blob, filename, format: 'html', size: blob.size }
  },
}
