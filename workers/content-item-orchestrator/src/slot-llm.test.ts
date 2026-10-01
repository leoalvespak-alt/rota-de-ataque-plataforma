import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatSlotCompletion, loadSlotLlmConfig, type SlotLlmConfig } from './slot-llm.js'

const base: SlotLlmConfig = {
  primaryEndpoint: 'https://llm.example/v1',
  primaryModel: 'm',
  primaryApiKey: 'k',
  fallbackEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
  fallbackModel: 'n',
  fallbackApiKey: 'fb',
  maxTokens: 10,
  timeoutMs: 1000,
}

function okResponse(content = '{"a":1}') {
  return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) }
}

describe('slot-llm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('returns null config without any key', () => {
    expect(loadSlotLlmConfig({} as NodeJS.ProcessEnv)).toBeNull()
  })

  it('calls the primary chat endpoint once', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    const result = await chatSlotCompletion(base, [{ role: 'user', content: 'hi' }])
    expect(result).toMatchObject({ provider: 'primary' })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://llm.example/v1/chat/completions')
  })

  it('does not duplicate the completions suffix on fallback', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('primary down'))
      .mockResolvedValueOnce(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    const result = await chatSlotCompletion(base, [{ role: 'user', content: 'hi' }])
    expect(result).toMatchObject({ provider: 'fallback' })
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe('https://openrouter.ai/api/v1/chat/completions')
  })

  it('throws when both providers fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    await expect(chatSlotCompletion(base, [{ role: 'user', content: 'hi' }])).rejects.toThrow()
  })
})
