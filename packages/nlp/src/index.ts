import { createHash } from 'node:crypto'
import { createDatabase, loadLlmRuntimeConfig } from '@plataforma/db'
import { EMBEDDING_DIM, embeddingsLatency } from '@plataforma/shared'
import { z } from 'zod'

interface EmbeddingCache { get(key: string): Promise<string | null>; set(key: string, value: string, mode: 'EX', ttl: number): Promise<unknown> }
export class LocalEmbeddingsClient {
  constructor(private endpoint: string, private model: string, private cache?: EmbeddingCache) {}
  async assertDimension() { const response = await fetch(`${this.endpoint}/info`); if (!response.ok) throw new Error('Embeddings /info unavailable'); const info = await response.json() as { embedding_dimension?: number; dim?: number; dimension?: number }; const dim = info.embedding_dimension ?? info.dimension ?? info.dim; if (dim !== EMBEDDING_DIM) throw new Error(`Embedding dimension ${dim ?? 'unknown'} != ${EMBEDDING_DIM}`) }
  async embed(text: string) { const key = `embedding:${this.model}:${createHash('sha256').update(text).digest('hex')}`; const hit = await this.cache?.get(key); if (hit) return JSON.parse(hit) as number[]; const stop = embeddingsLatency.startTimer({ model: this.model }); try { const response = await fetch(`${this.endpoint}/embed`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inputs: text }) }); if (!response.ok) throw new Error(`Embedding error ${response.status}`); const vectors = await response.json() as number[][]; const vector = vectors[0] ?? []; if (vector.length !== EMBEDDING_DIM) throw new Error('Invalid embedding dimension'); await this.cache?.set(key, JSON.stringify(vector), 'EX', 86400 * 30); return vector } finally { stop() } }
}
export function cheapFilter(text: string) { const value = text.trim(); return value.length < 3 || /^(?:[\p{Emoji}\s])+$/u.test(value) || /(?:ganhe dinheiro|clique aqui).*(?:bit\.ly|t\.me)/i.test(value) }
export interface Classification { intent: string; topic: string; sentiment: 'pos' | 'neutral' | 'neg'; purchase_signal: boolean; is_question: boolean; pain_point: string | null; confidence: number }
const ClassificationSchema = z.object({ intent: z.string().min(1), topic: z.string().min(1), sentiment: z.enum(['pos', 'neutral', 'neg']), purchase_signal: z.boolean(), is_question: z.boolean(), pain_point: z.string().nullable(), confidence: z.number().min(0).max(1) })
export async function classifyComment(text: string, llm: (prompt: string) => Promise<string>): Promise<Classification | null> { if (cheapFilter(text)) return null; const raw = await llm(`Classifique o comentário em JSON estrito com intent, topic, sentiment(pos|neutral|neg), purchase_signal, is_question, pain_point e confidence(0..1). Comentário: ${text}`); return ClassificationSchema.parse(JSON.parse(raw.replace(/^```(?:json)?|```$/g, '').trim())) }

export class HttpJsonLlmClient {
  constructor(private endpoint: string | undefined, private model: string, private apiKey?: string, private provider: 'anthropic' | 'openai-compatible' = 'openai-compatible', private maxOutputTokens = 512, private temperature = 0, private databaseManaged = true) {}
  async complete(prompt: string) {
    const managed = this.databaseManaged ? await currentDatabaseConfig() : undefined
    const provider = managed?.provider ?? this.provider, endpoint = managed?.endpoint ?? this.endpoint, model = managed?.model ?? this.model, apiKey = managed?.apiKey ?? this.apiKey, maxOutputTokens = managed?.maxOutputTokens ?? this.maxOutputTokens, temperature = managed?.temperature ?? this.temperature
    const anthropic = provider === 'anthropic'
    const url = anthropic ? `${(endpoint || 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages` : `${endpoint?.replace(/\/$/, '')}/v1/chat/completions`
    if (!anthropic && !endpoint) throw new Error('LLM_ENDPOINT is required for openai-compatible provider')
    const headers = new Headers({ 'content-type': 'application/json' })
    if (anthropic) { headers.set('x-api-key', apiKey ?? ''); headers.set('anthropic-version', '2023-06-01') }
    else if (apiKey) headers.set('authorization', `Bearer ${apiKey}`)
    const body = anthropic ? { model, max_tokens: maxOutputTokens, temperature, system: 'Responda apenas JSON válido.', messages: [{ role: 'user', content: prompt }] } : { model, max_tokens: maxOutputTokens, temperature, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Responda apenas JSON válido.' }, { role: 'user', content: prompt }] }
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!response.ok) throw new Error(`LLM error ${response.status}: ${await response.text()}`)
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; content?: Array<{ type?: string; text?: string }> }
    const content = anthropic ? payload.content?.find((item) => item.type === 'text')?.text : payload.choices?.[0]?.message?.content
    if (!content) throw new Error('LLM returned no content')
    return content
  }
}

export interface DynamicLlmConfig { endpoint?: string; model: string; apiKey?: string; provider: 'anthropic' | 'openai-compatible'; maxOutputTokens?: number; temperature?: number }
let databaseRuntime: { value: DynamicLlmConfig; expiresAt: number } | undefined
let runtimePool: ReturnType<typeof createDatabase>['pool'] | undefined
async function currentDatabaseConfig(): Promise<DynamicLlmConfig | undefined> {
  if (!process.env.DATABASE_URL) return undefined
  const now = Date.now()
  if (databaseRuntime && databaseRuntime.expiresAt > now) return databaseRuntime.value
  runtimePool ??= createDatabase(process.env.DATABASE_URL).pool
  const value = await loadLlmRuntimeConfig(runtimePool)
  databaseRuntime = { value, expiresAt: now + 30_000 }
  return value
}
export class ConfigurableLlmClient {
  private cached?: { value: DynamicLlmConfig; expiresAt: number }
  constructor(private load: () => Promise<DynamicLlmConfig>, private ttlMs = 30_000) {}
  async complete(prompt: string) {
    const now = Date.now()
    if (!this.cached || this.cached.expiresAt <= now) this.cached = { value: await this.load(), expiresAt: now + this.ttlMs }
    const config = this.cached.value
    return new HttpJsonLlmClient(config.endpoint, config.model, config.apiKey, config.provider, config.maxOutputTokens, config.temperature, false).complete(prompt)
  }
  clearCache() { this.cached = undefined }
}
export function cosine(left: number[], right: number[]) { const dot = left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0); const norm = (values: number[]) => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)); return dot / (norm(left) * norm(right) || 1) }
