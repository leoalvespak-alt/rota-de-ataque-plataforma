import { describe, it, expect } from 'vitest'
import { validateTextLength, validateContrast, adjustTypography } from './visualValidator'

describe('Visual Validator', () => {
  describe('validateTextLength', () => {
    it('returns no issues for text within limit', () => {
      const issues = validateTextLength('Hello', 10, 'title')
      expect(issues).toHaveLength(0)
    })

    it('returns warning for text exceeding limit', () => {
      const issues = validateTextLength('A very long text that exceeds the limit', 10, 'title')
      expect(issues).toHaveLength(1)
      expect(issues[0]!.severity).toBe('warning')
      expect(issues[0]!.field).toBe('title')
    })

    it('returns no issues for text at exact limit', () => {
      const issues = validateTextLength('1234567890', 10, 'title')
      expect(issues).toHaveLength(0)
    })
  })

  describe('validateContrast', () => {
    it('passes for high contrast (black on white)', () => {
      const issues = validateContrast('#000000', '#FFFFFF')
      expect(issues).toHaveLength(0)
    })

    it('fails for very low contrast', () => {
      const issues = validateContrast('#777777', '#888888')
      expect(issues).toHaveLength(1)
      expect(issues[0]!.severity).toBe('error')
    })

    it('warns for medium contrast', () => {
      const issues = validateContrast('#666666', '#FFFFFF')
      expect(issues.length).toBeLessThanOrEqual(1)
    })
  })

  describe('adjustTypography', () => {
    it('uses normal strategy for short text', () => {
      const result = adjustTypography('Hi', 800, 16)
      expect(result.strategy).toBe('normal')
      expect(result.fontSize).toBe(16)
    })

    it('uses tracking strategy for medium text', () => {
      const text = 'A'.repeat(100)
      const result = adjustTypography(text, 200, 16)
      expect(['tracking', 'reduced', 'compact']).toContain(result.strategy)
    })

    it('uses compact strategy for very long text', () => {
      const text = 'A'.repeat(500)
      const result = adjustTypography(text, 200, 16)
      expect(result.strategy).toBe('compact')
      expect(result.fontSize).toBeLessThan(16)
    })

    it('never goes below 11px', () => {
      const text = 'A'.repeat(1000)
      const result = adjustTypography(text, 100, 12)
      expect(result.fontSize).toBeGreaterThanOrEqual(11)
    })
  })
})
