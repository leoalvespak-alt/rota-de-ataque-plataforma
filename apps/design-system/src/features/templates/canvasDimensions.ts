import type { CanvasFormat } from './types'

export const CANVAS_DIMENSIONS: Record<CanvasFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  feed: { width: 1080, height: 1350 },
  portrait: { width: 1080, height: 1920 },
}

export function getCanvasDimensions(format: CanvasFormat) {
  return CANVAS_DIMENSIONS[format]
}

export function getCanvasAspectRatio(format: CanvasFormat) {
  const { width, height } = getCanvasDimensions(format)
  return `${width} / ${height}`
}
