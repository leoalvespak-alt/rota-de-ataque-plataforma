import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CARD_LAYOUT,
  getAutoFitFactor,
  getCardLayoutSettings,
  getLineHeight,
} from './cardLayout'

describe('card layout settings', () => {
  it('preserves the original rendering until the user opts in', () => {
    expect(getCardLayoutSettings({})).toEqual(DEFAULT_CARD_LAYOUT)
    expect(getLineHeight('balanced', true)).toBeUndefined()
    expect(getLineHeight('balanced', false)).toBeUndefined()
  })

  it('sanitizes persisted per-card settings', () => {
    expect(getCardLayoutSettings({ _layout: { autoFit: true, textScale: 999, spacing: 'compact' } })).toEqual({
      autoFit: true,
      textScale: 120,
      spacing: 'compact',
    })
  })

  it('shrinks long copy while leaving short labels untouched', () => {
    expect(getAutoFitFactor('title', 'Título curto', 700, 70)).toBe(1)
    expect(getAutoFitFactor('title', 'Um título muito longo '.repeat(12), 400, 70)).toBeLessThan(0.8)
    expect(getAutoFitFactor('page', '01 / 05', 100, 20)).toBe(1)
  })
})
