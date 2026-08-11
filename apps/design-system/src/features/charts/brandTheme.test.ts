import { describe, it, expect } from 'vitest'
import { brandChartColors, getBrandChartTheme } from './brandTheme'

describe('Brand Chart Theme', () => {
  it('has 8 brand colors', () => {
    expect(brandChartColors).toHaveLength(8)
    expect(brandChartColors[0]).toBe('#C1121F')
    expect(brandChartColors[1]).toBe('#D4A017')
  })

  it('returns light theme', () => {
    const theme = getBrandChartTheme(false)
    expect(theme.backgroundColor).toBe('transparent')
    expect(theme.color).toEqual(brandChartColors)
    expect(theme.textStyle?.color).toBe('#3D3D3D')
  })

  it('returns dark theme', () => {
    const theme = getBrandChartTheme(true)
    expect(theme.textStyle?.color).toBe('#B0B0B0')
  })

  it('uses Rajdhani for titles', () => {
    const theme = getBrandChartTheme(false)
    const title = Array.isArray(theme.title) ? theme.title[0] : theme.title
    expect(title?.textStyle?.fontFamily).toContain('Rajdhani')
  })

  it('uses IBM Plex Sans for body text', () => {
    const theme = getBrandChartTheme(false)
    expect(theme.textStyle?.fontFamily).toContain('IBM Plex Sans')
  })
})
