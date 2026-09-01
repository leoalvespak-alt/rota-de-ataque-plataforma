import { describe, expect, it } from 'vitest'
import { logicalEntityKey, opportunityScore, reconcileBudget, reserveBudget, robustOutlier } from './index.js'

describe('organic intelligence contracts', () => {
  it('deduplicates provider observations by platform and canonical URL', () => {
    const base = { platform: 'web' as const, externalId: '1', canonicalUrl: 'https://example.com/item?utm=x', observedAt: new Date().toISOString(), metrics: {}, rawSchemaVersion: 'v1' }
    expect(logicalEntityKey({ ...base, provider: 'news_radar' })).toBe(logicalEntityKey({ ...base, provider: 'manual', externalId: '2', canonicalUrl: 'https://example.com/item/' }))
  })
  it('blocks budget before network and reconciles actual cost', () => {
    const reserved = reserveBudget({ limitUsd: 10, reservedUsd: 0, spentUsd: 2 }, 3)
    expect(reconcileBudget(reserved, 3, 2.5)).toEqual({ limitUsd: 10, reservedUsd: 0, spentUsd: 4.5 })
    expect(() => reserveBudget(reserved, 6)).toThrow('BUDGET_BLOCKED')
  })
  it('reduces confidence during cold start', () => expect(robustOutlier([1, 2], 100).confidence).toBeLessThan(1))
  it('keeps score decomposition and version', () => expect(opportunityScore({ relativePerformance: 1, recurrence: 1, growth: 1, audiencePain: 1, utility: 1, audienceFit: 1, freshness: 1, saturation: 0, confidence: 1, historicalFit: 1, marginalCostPenalty: 0 }).version).toBe('organic-opportunity-v1'))
})
