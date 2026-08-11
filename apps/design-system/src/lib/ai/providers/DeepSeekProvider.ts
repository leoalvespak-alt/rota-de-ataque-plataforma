import type { TextProvider, TextGenerationRequest, TextGenerationResponse } from './types'

export class DeepSeekProvider implements TextProvider {
  id = 'deepseek'
  name = 'DeepSeek'
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl = 'https://api.deepseek.com') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0
  }

  async generate(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
          { role: 'user' as const, content: request.prompt },
        ],
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`)
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
      usage?: { prompt_tokens: number; completion_tokens: number }
    }

    const text = data.choices[0]?.message.content ?? ''
    let parsed: unknown = undefined

    if (request.responseSchema) {
      try {
        const json = JSON.parse(text)
        parsed = request.responseSchema.parse(json)
      } catch {
        parsed = undefined
      }
    }

    return {
      text,
      parsed,
      usage: data.usage
        ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
        : undefined,
      model: 'deepseek-chat',
      provider: this.id,
    }
  }
}
