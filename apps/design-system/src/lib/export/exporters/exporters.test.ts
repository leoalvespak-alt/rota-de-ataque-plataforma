import { describe, it, expect } from 'vitest'
import { getExporter, getAvailableFormats } from './index'

describe('Export Registry', () => {
  it('returns available formats', () => {
    const formats = getAvailableFormats()
    expect(formats).toContain('png')
    expect(formats).toContain('jpeg')
    expect(formats).toContain('html')
    expect(formats).toContain('pptx')
  })

  it('returns exporter for png', () => {
    const exporter = getExporter('png')
    expect(exporter).toBeDefined()
    expect(exporter?.format).toBe('png')
  })

  it('returns exporter for html', () => {
    const exporter = getExporter('html')
    expect(exporter).toBeDefined()
    expect(exporter?.format).toBe('html')
  })

  it('returns undefined for unknown format', () => {
    const exporter = getExporter('xyz' as never)
    expect(exporter).toBeUndefined()
  })
})
