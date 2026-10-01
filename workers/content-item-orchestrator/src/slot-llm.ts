export interface SlotChatMessage {
  role: 'system' | 'user'
  content: string
}

export interface SlotLlmConfig {
  primaryEndpoint: string
  primaryModel: string
  primaryApiKey: string
  fallbackEndpoint: string
  fallbackModel: string
  fallbackApiKey: string
  maxTokens: number
  timeoutMs: number
}

export function loadSlotLlmConfig(env: NodeJS.ProcessEnv = process.env): SlotLlmConfig | null {
  const primaryApiKey = (env.LLM_API_KEY ?? env.DEEPSEEK_API_KEY_DESIGN_SYSTEM ?? '').trim()
  const primaryEndpoint = (env.LLM_ENDPOINT ?? 'https://api.deepseek.com/v1').trim()
  const primaryModel = (env.LLM_MODEL ?? env.RADAR_DEEPSEEK_MODEL ?? 'deepseek-v4-flash').trim()
  const fallbackApiKey = (env.OPENROUTER_API_KEY ?? '').trim()
  if (!primaryApiKey && !fallbackApiKey) return null
  return {
    primaryEndpoint,
    primaryModel,
    primaryApiKey,
    fallbackEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
    fallbackModel: (env.RADAR_GLM_FALLBACK_MODEL ?? 'z-ai/glm-5.3-flash').trim(),
    fallbackApiKey,
    maxTokens: 2048,
    timeoutMs: 60000,
  }
}

async function chatOnce(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: SlotChatMessage[],
  maxTokens: number,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('slot LLM timeout')), timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const base = endpoint.replace(/\/+$/, '')
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://design.rotadeataque.com.br',
        'X-Title': 'Rota Editorial slot composer',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages,
      }),
    })
    if (!response.ok) throw new Error(`slot LLM HTTP ${response.status}`)
    const data = (await response.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>
    } | null
    const content = data?.choices?.[0]?.message?.content
    if (!content || !content.trim()) throw new Error('slot LLM empty response')
    return content
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** Primary with OpenRouter fallback. Throws when both fail. */
export async function chatSlotCompletion(
  config: SlotLlmConfig,
  messages: SlotChatMessage[],
  signal?: AbortSignal,
): Promise<{ content: string; provider: 'primary' | 'fallback' }> {
  if (config.primaryApiKey) {
    try {
      const content = await chatOnce(
        config.primaryEndpoint, config.primaryApiKey, config.primaryModel,
        messages, config.maxTokens, config.timeoutMs, signal,
      )
      return { content, provider: 'primary' }
    } catch {
      if (!config.fallbackApiKey) throw new Error('slot LLM primary failed and no fallback configured')
    }
  }
  if (!config.fallbackApiKey) throw new Error('slot LLM is not configured')
  const content = await chatOnce(
    config.fallbackEndpoint, config.fallbackApiKey, config.fallbackModel,
    messages, config.maxTokens, config.timeoutMs, signal,
  )
  return { content, provider: 'fallback' }
}
