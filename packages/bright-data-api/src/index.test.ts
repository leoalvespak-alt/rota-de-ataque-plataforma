import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrightDataClient } from './index.js'

afterEach(() => vi.restoreAllMocks())

describe('BrightDataClient', () => {
  it('requires an explicit allowed fallback and a bounded sample', async () => {
    const client = new BrightDataClient('secret', 'dataset')
    await expect(client.collect({ urls: Array.from({ length: 11 }, (_, index) => `https://example.com/${index}`), reason: 'validation_sample' })).rejects.toThrow('INVALID_SAMPLE_SIZE')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ snapshot_id: 's1' }), { status: 200 }))
    await client.collect({ urls: ['https://example.com/a'], reason: 'primary_failed' })
    expect((fetchMock.mock.calls[0]![1]?.headers as Record<string, string>).Authorization).toBe('Bearer secret')
  })
})
