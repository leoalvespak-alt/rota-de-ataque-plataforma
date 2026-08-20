import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExaClient } from './index.js'

afterEach(() => vi.restoreAllMocks())

describe('ExaClient', () => {
  it('bounds results, validates the contract and keeps the key in a header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ requestId: 'r1', results: [{ id: 'x', url: 'https://example.com/a', title: 'A' }] }), { status: 200 }))
    const result = await new ExaClient('secret').search({ query: 'rota', limit: 999 })
    expect(result.results).toHaveLength(1)
    const [url, options] = fetchMock.mock.calls[0]!
    expect(String(url)).not.toContain('secret')
    expect((options?.headers as Record<string, string>)['x-api-key']).toBe('secret')
    expect(JSON.parse(String(options?.body)).numResults).toBe(25)
  })
})
