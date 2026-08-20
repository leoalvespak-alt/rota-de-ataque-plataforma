import { describe, expect, it } from 'vitest'
import { resolvePageState } from './page-state'

describe('page state recovery contract', () => {
  it('keeps loading, empty, no-campaign and provider failure distinct', () => {
    expect(resolvePageState({ loading: true, hasCampaign: true, itemCount: 0 })).toBe('loading')
    expect(resolvePageState({ hasCampaign: false, itemCount: 0 })).toBe('no_campaign')
    expect(resolvePageState({ hasCampaign: true, itemCount: 0 })).toBe('empty')
    expect(resolvePageState({ hasCampaign: true, itemCount: 0, providerAvailable: false })).toBe('provider_error')
  })

  it('prioritizes permission and server recovery states over empty copy', () => {
    expect(resolvePageState({ hasCampaign: true, itemCount: 0, permitted: false })).toBe('forbidden')
    expect(resolvePageState({ hasCampaign: true, itemCount: 3, failed: true })).toBe('error')
    expect(resolvePageState({ hasCampaign: true, itemCount: 3 })).toBe('ready')
  })
})
