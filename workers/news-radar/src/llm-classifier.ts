import type { RadarClassification } from './index.js'

export interface JsonModel {
  provider: string
  endpoint: string
  model: string
  apiKey?: string
}

export interface JsonModelResult {
  provider: string
  model: string
  value: RadarClassification
  inputTokens?: number
  outputTokens?: number
}

type Requester = typeof fetch

async function requestJsonObject(model: JsonModel, prompt: string, signal: AbortSignal | undefined, requester: Requester, maxTokens: number) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (model.provider === 'anthropic') {
    if (model.apiKey) headers['x-api-key'] = model.apiKey
    headers['anthropic-version'] = '2023-06-01'
  } else if (model.apiKey) {
    headers.Authorization = `Bearer ${model.apiKey}`
  }
  const response = await requester(model.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0,
      ...(model.provider !== 'openrouter' && model.model.toLowerCase().startsWith('deepseek-')
        ? { thinking: { type: 'disabled' } }
        : {}),
      ...(model.provider === 'anthropic' ? {} : { response_format: { type: 'json_object' } }),
    }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`LLM request failed (${response.status})`)
  const data = await response.json() as {
    choices?: Array<{ finish_reason?: string | null; message?: { content?: string | null } }>
    content?: Array<{ text?: string }>
    usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number }
  }
  const choice = data.choices?.[0]
  if (choice?.finish_reason === 'length') throw new Error('LLM output was truncated at max_tokens')
  const content = model.provider === 'anthropic' ? data.content?.[0]?.text : choice?.message?.content
  if (typeof content !== 'string' || content.trim() === '') throw new Error('LLM returned no JSON content')
  const value = JSON.parse(content) as Record<string, unknown>
  if (!value || typeof value !== 'object' || typeof value.is_police_relevant !== 'boolean') {
    throw new Error('LLM returned an invalid radar classification')
  }
  return {
    provider: model.provider,
    model: model.model,
    value: value as unknown as RadarClassification,
    inputTokens: data.usage?.prompt_tokens ?? data.usage?.input_tokens,
    outputTokens: data.usage?.completion_tokens ?? data.usage?.output_tokens,
  }
}

export async function classifyWithFallback(input: {
  prompt: string
  primary: JsonModel
  fallback?: JsonModel
  maxTokens: number
  signal?: AbortSignal
  requester?: Requester
}): Promise<JsonModelResult> {
  const requester = input.requester ?? fetch
  try {
    return await requestJsonObject(input.primary, input.prompt, input.signal, requester, input.maxTokens)
  } catch (primaryError) {
    if (input.signal?.aborted) throw primaryError
    if (!input.fallback) throw primaryError
    return requestJsonObject(input.fallback, input.prompt, input.signal, requester, input.maxTokens)
  }
}
