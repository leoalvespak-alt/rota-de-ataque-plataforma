import { z } from 'zod'

const resultSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string().default(''),
  publishedDate: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
})
const responseSchema = z.object({ requestId: z.string().optional(), results: z.array(resultSchema) })
export type ExaResult = z.infer<typeof resultSchema>

export class ExaClient {
  constructor(private readonly apiKey: string, private readonly endpoint = 'https://api.exa.ai') {}
  isConfigured() { return this.apiKey.trim().length > 0 }
  async search(input: { query: string; limit?: number; startPublishedDate?: string; signal?: AbortSignal }): Promise<{ requestId?: string; results: ExaResult[] }> {
    if (!this.isConfigured()) throw new Error('EXA_NOT_CONFIGURED')
    const response = await request(`${this.endpoint}/search`, this.apiKey, {
      query: input.query, numResults: Math.min(25, Math.max(1, input.limit ?? 10)),
      startPublishedDate: input.startPublishedDate, contents: { text: { maxCharacters: 5000 } },
    }, input.signal)
    return responseSchema.parse(response)
  }
}

async function request(url: string, apiKey: string, payload: unknown, signal?: AbortSignal): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }, body: JSON.stringify(payload), signal: controller.signal })
      if (response.ok) return response.json()
      if (![429, 502, 503, 504].includes(response.status) || attempt === 2) throw new Error(`EXA_HTTP_${response.status}`)
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt))
  }
  throw new Error('EXA_UNAVAILABLE')
}
