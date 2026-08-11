import { createHash } from 'node:crypto'
import { EMBEDDING_DIM, embeddingsLatency } from '@plataforma/shared'
import { z } from 'zod'

interface EmbeddingCache { get(key: string): Promise<string | null>; set(key: string, value: string, mode: 'EX', ttl: number): Promise<unknown> }
export class LocalEmbeddingsClient {
  constructor(private endpoint: string, private model: string, private cache?: EmbeddingCache) {}
  async assertDimension() { const response = await fetch(`${this.endpoint}/info`); if (!response.ok) throw new Error('Embeddings /info unavailable'); const info = await response.json() as { embedding_dimension?: number; dim?: number }; const dim = info.embedding_dimension ?? info.dim; if (dim !== EMBEDDING_DIM) throw new Error(`Embedding dimension ${dim} != ${EMBEDDING_DIM}`) }
  async embed(text: string) { const key = `embedding:${this.model}:${createHash('sha256').update(text).digest('hex')}`; const hit = await this.cache?.get(key); if (hit) return JSON.parse(hit) as number[]; const stop = embeddingsLatency.startTimer({ model: this.model }); try { const response = await fetch(`${this.endpoint}/embed`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inputs: text }) }); if (!response.ok) throw new Error(`Embedding error ${response.status}`); const vectors = await response.json() as number[][]; const vector = vectors[0] ?? []; if (vector.length !== EMBEDDING_DIM) throw new Error('Invalid embedding dimension'); await this.cache?.set(key, JSON.stringify(vector), 'EX', 86400 * 30); return vector } finally { stop() } }
}
export function cheapFilter(text: string) { const value = text.trim(); return value.length < 3 || /^(?:[\p{Emoji}\s])+$/u.test(value) || /(?:ganhe dinheiro|clique aqui).*(?:bit\.ly|t\.me)/i.test(value) }
export interface Classification { intent: string; topic: string; sentiment: 'pos' | 'neutral' | 'neg'; purchase_signal: boolean; is_question: boolean; pain_point: string | null; confidence: number }
const ClassificationSchema = z.object({ intent: z.string().min(1), topic: z.string().min(1), sentiment: z.enum(['pos', 'neutral', 'neg']), purchase_signal: z.boolean(), is_question: z.boolean(), pain_point: z.string().nullable(), confidence: z.number().min(0).max(1) })
export async function classifyComment(text: string, llm: (prompt: string) => Promise<string>): Promise<Classification | null> { if (cheapFilter(text)) return null; const raw = await llm(`Classifique o comentário em JSON estrito com intent, topic, sentiment(pos|neutral|neg), purchase_signal, is_question, pain_point e confidence(0..1). Comentário: ${text}`); return ClassificationSchema.parse(JSON.parse(raw.replace(/^```(?:json)?|```$/g, '').trim())) }

export class HttpJsonLlmClient {
  constructor(private endpoint: string | undefined, private model: string, private apiKey?: string, private provider: 'anthropic' | 'openai-compatible' = 'openai-compatible') {}
  async complete(prompt: string) {
    const anthropic = this.provider === 'anthropic'
    const url = anthropic ? 'https://api.anthropic.com/v1/messages' : `${this.endpoint?.replace(/\/$/, '')}/v1/chat/completions`
    if (!anthropic && !this.endpoint) throw new Error('LLM_ENDPOINT is required for openai-compatible provider')
    const headers = new Headers({ 'content-type': 'application/json' })
    if (anthropic) { headers.set('x-api-key', this.apiKey ?? ''); headers.set('anthropic-version', '2023-06-01') }
    else if (this.apiKey) headers.set('authorization', `Bearer ${this.apiKey}`)
    const body = anthropic ? { model: this.model, max_tokens: 512, temperature: 0, system: 'Responda apenas JSON válido.', messages: [{ role: 'user', content: prompt }] } : { model: this.model, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Responda apenas JSON válido.' }, { role: 'user', content: prompt }] }
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!response.ok) throw new Error(`LLM error ${response.status}: ${await response.text()}`)
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; content?: Array<{ type?: string; text?: string }> }
    const content = anthropic ? payload.content?.find((item) => item.type === 'text')?.text : payload.choices?.[0]?.message?.content
    if (!content) throw new Error('LLM returned no content')
    return content
  }
}
export function cosine(left: number[], right: number[]) { const dot = left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0); const norm = (values: number[]) => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)); return dot / (norm(left) * norm(right) || 1) }
