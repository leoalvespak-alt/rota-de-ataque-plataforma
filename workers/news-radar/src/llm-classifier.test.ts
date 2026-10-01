import { describe, expect, it, vi } from 'vitest'
import { classifyWithFallback } from './llm-classifier.js'

describe('news classifier provider fallback', () => {
  it('uses GLM through OpenRouter when the primary DeepSeek request fails', async () => {
    const requester = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ is_police_relevant: true, categoria: 'PC' }) } }],
        usage: { prompt_tokens: 20, completion_tokens: 10 },
      }), { status: 200 }))
    const result = await classifyWithFallback({
      prompt: 'Classifique somente o texto fornecido.',
      primary: { provider: 'deepseek', endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-v4-flash', apiKey: 'primary-secret' },
      fallback: { provider: 'openrouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions', model: 'z-ai/glm-5.3-flash', apiKey: 'fallback-secret' },
      maxTokens: 512,
      requester,
    })

    expect(result).toMatchObject({ provider: 'openrouter', model: 'z-ai/glm-5.3-flash', value: { is_police_relevant: true, categoria: 'PC' }, inputTokens: 20, outputTokens: 10 })
    expect(requester).toHaveBeenCalledTimes(2)
    expect(requester.mock.calls[1]?.[0]).toBe('https://openrouter.ai/api/v1/chat/completions')
  })

  it('does not invoke the fallback after task cancellation', async () => {
    const controller = new AbortController()
    controller.abort()
    const requester = vi.fn<typeof fetch>().mockRejectedValue(new Error('aborted'))
    await expect(classifyWithFallback({
      prompt: 'x',
      primary: { provider: 'deepseek', endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-v4-flash' },
      fallback: { provider: 'openrouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions', model: 'z-ai/glm-5.3-flash' },
      maxTokens: 512,
      signal: controller.signal,
      requester,
    })).rejects.toThrow('aborted')
    expect(requester).toHaveBeenCalledTimes(1)
  })

  it('disables DeepSeek thinking for bounded JSON classification', async () => {
    const requester = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ is_police_relevant: true }) } }],
      usage: { prompt_tokens: 4, completion_tokens: 5 },
    }), { status: 200 }))

    await classifyWithFallback({
      prompt: 'Return JSON.',
      primary: { provider: 'openai-compatible', endpoint: 'https://api.deepseek.com/chat/completions', model: 'deepseek-v4-flash' },
      maxTokens: 1024,
      requester,
    })

    const body = JSON.parse(String(requester.mock.calls[0]?.[1]?.body))
    expect(body).toMatchObject({ thinking: { type: 'disabled' }, response_format: { type: 'json_object' }, max_tokens: 1024 })
  })

  it('falls back when the primary response is truncated at its token limit', async () => {
    const requester = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{"is_police_relevant":' } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ is_police_relevant: true }) } }],
      }), { status: 200 }))

    const result = await classifyWithFallback({
      prompt: 'Return JSON.',
      primary: { provider: 'openai-compatible', endpoint: 'https://api.deepseek.com/chat/completions', model: 'deepseek-v4-flash' },
      fallback: { provider: 'openrouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions', model: 'z-ai/glm-5.3-flash' },
      maxTokens: 1024,
      requester,
    })

    expect(result.provider).toBe('openrouter')
    expect(requester).toHaveBeenCalledTimes(2)
    const fallbackBody = JSON.parse(String(requester.mock.calls[1]?.[1]?.body))
    expect(fallbackBody).not.toHaveProperty('reasoning')
    expect(fallbackBody.response_format).toEqual({ type: 'json_object' })
    expect(fallbackBody.max_tokens).toBe(1024)
  })
})
