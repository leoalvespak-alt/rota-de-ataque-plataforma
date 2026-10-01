import { describe, expect, it } from 'vitest'
import { getCanvasAspectRatio, getCanvasDimensions } from './canvasDimensions'

describe('canvas dimensions', () => {
  it('keeps feed, legacy square, and Story canvases distinct', () => {
    expect(getCanvasDimensions('feed')).toEqual({ width: 1080, height: 1350 })
    expect(getCanvasDimensions('square')).toEqual({ width: 1080, height: 1080 })
    expect(getCanvasDimensions('portrait')).toEqual({ width: 1080, height: 1920 })
  })

  it('uses the same ratio in previews and export wrappers', () => {
    expect(getCanvasAspectRatio('feed')).toBe('1080 / 1350')
    expect(getCanvasAspectRatio('portrait')).toBe('1080 / 1920')
  })
})
