import { describe, expect, it, vi } from 'vitest'
import { normalizeInstagramInsights, upsertInstagramPerformance } from './instagram-performance.js'

describe('Instagram content performance', () => {
  it('normalizes current Meta metric shapes with safe fallbacks', () => {
    expect(normalizeInstagramInsights([
      { name: 'views', values: [{ value: 120 }] },
      { name: 'reach', total_value: { value: 80 } },
      { name: 'saved', value: 4 },
      { name: 'shares', values: [{ value: 3 }] },
    ], { likes: 10, comments: 2 })).toEqual({ impressions: 120, reach: 80, engagements: 19, saves: 4, shares: 3 })
  })

  it('uses the cumulative GREATEST upsert keyed by published media', async () => {
    const query = vi.fn(async () => undefined)
    await upsertInstagramPerformance({ query }, 'ig-media', { impressions: 120, reach: 80, engagements: 19, saves: 4, shares: 3 })
    expect(query).toHaveBeenCalledWith(expect.stringContaining('GREATEST(content_performance.impressions'), ['ig-media', 120, 80, 19, 4, 3])
  })
})
