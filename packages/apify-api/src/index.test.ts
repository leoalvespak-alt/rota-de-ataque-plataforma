import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApifyClient } from './index.js'

afterEach(() => vi.restoreAllMocks())

describe('ApifyClient', () => {
  it('uses bearer auth and injects the versioned input contract', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { id: 'run', status: 'READY', defaultDatasetId: 'data' } }), { status: 200 }))
    await new ApifyClient('secret').start({ actorId: 'owner/actor', schemaVersion: '1' }, { maxItems: 10 })
    const [url, options] = fetchMock.mock.calls[0]!
    expect(String(url)).not.toContain('secret')
    expect((options?.headers as Record<string, string>).Authorization).toBe('Bearer secret')
    expect(JSON.parse(String(options?.body))._schemaVersion).toBe('1')
  })
})
