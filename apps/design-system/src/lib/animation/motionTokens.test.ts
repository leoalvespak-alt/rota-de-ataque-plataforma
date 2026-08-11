import { describe, it, expect } from 'vitest'
import { motionTokens, motionPresets } from './motionTokens'

describe('Motion Tokens', () => {
  it('has all duration values', () => {
    expect(motionTokens.duration.instant).toBe(0.05)
    expect(motionTokens.duration.fast).toBe(0.15)
    expect(motionTokens.duration.normal).toBe(0.25)
    expect(motionTokens.duration.slow).toBe(0.4)
    expect(motionTokens.duration.slower).toBe(0.6)
  })

  it('has easing curves', () => {
    expect(motionTokens.easing.default).toEqual([0.2, 0, 0, 1])
    expect(motionTokens.easing.spring.type).toBe('spring')
    expect(motionTokens.easing.spring.stiffness).toBe(300)
  })

  it('has fadeIn preset with correct initial/animate', () => {
    expect(motionPresets.fadeIn.initial).toEqual({ opacity: 0 })
    expect(motionPresets.fadeIn.animate).toEqual({ opacity: 1 })
  })

  it('has slideUp preset with y offset', () => {
    expect(motionPresets.slideUp.initial).toEqual({ opacity: 0, y: 20 })
    expect(motionPresets.slideUp.animate).toEqual({ opacity: 1, y: 0 })
  })

  it('has scaleIn preset', () => {
    expect(motionPresets.scaleIn.initial.scale).toBe(0.95)
    expect(motionPresets.scaleIn.animate.scale).toBe(1)
  })

  it('has springBounce preset using spring easing', () => {
    expect(motionPresets.springBounce.transition).toEqual(motionTokens.easing.spring)
  })
})
