export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'pdf' | 'html' | 'pptx'

export interface ExportOptions {
  format: ExportFormat
  width: number
  height: number
  scale?: number
  quality?: number
  filename?: string
}

export interface ExportResult {
  blob: Blob
  filename: string
  format: ExportFormat
  size: number
}

export interface Exporter {
  format: ExportFormat
  label: string
  export(element: HTMLElement, options: ExportOptions): Promise<ExportResult>
}
