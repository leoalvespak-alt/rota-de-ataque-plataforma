import { createHash } from 'node:crypto'
import type { EmbeddingProvider } from '@/lib/ai/providers/types'
import { RAG_EMBEDDING_DIMENSIONS } from './pg-vector-store'

export interface EmbeddingModelIdentity {
  modelName: string
  modelVersion: string
}

function assertEmbedding(embedding: number[]): number[] {
  if (embedding.length !== RAG_EMBEDDING_DIMENSIONS) {
    throw new Error(`O provedor de embeddings deve retornar ${RAG_EMBEDDING_DIMENSIONS} dimensões; recebeu ${embedding.length}`)
  }
  if (embedding.some((value) => !Number.isFinite(value))) {
    throw new Error('O provedor de embeddings retornou um valor não finito')
  }
  return embedding
}

export class EmbeddingService {
  private readonly provider: EmbeddingProvider
  private readonly identity: EmbeddingModelIdentity

  constructor(provider: EmbeddingProvider, identity: EmbeddingModelIdentity) {
    this.provider = provider
    this.identity = identity
  }

  get model(): EmbeddingModelIdentity { return this.identity }

  async embedText(text: string): Promise<number[]> {
    return assertEmbedding(await this.provider.embed(text))
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    if (!texts.length) return []
    const embeddings = this.provider.embedMany ? await this.provider.embedMany(texts) : await Promise.all(texts.map((text) => this.provider.embed(text)))
    if (embeddings.length !== texts.length) throw new Error(`O provedor retornou ${embeddings.length} embeddings para ${texts.length} textos`)
    return embeddings.map(assertEmbedding)
  }

  async embedChunks<T extends { content: string }>(chunks: T[]) {
    const embeddings = await this.embedMany(chunks.map((chunk) => chunk.content))
    return chunks.map((chunk, index) => ({ chunk, embedding: embeddings[index]! }))
  }
}

/**
 * Zero-cost local fallback used when no embedding endpoint is configured.
 * It is deterministic, 768-dimensional and intentionally names itself as a
 * fallback so it can be replaced/reindexed with a semantic model later.
 */
export class LocalHashEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'local-hash-768'
  readonly name = 'Local hash embedding (fallback)'

  getDimensions() { return RAG_EMBEDDING_DIMENSIONS }
  isConfigured() { return true }

  async embed(text: string): Promise<number[]> {
    const vector = Array.from({ length: RAG_EMBEDDING_DIMENSIONS }, () => 0)
    const tokens = text.toLocaleLowerCase('pt-BR').match(/[\p{L}\p{N}]+/gu) ?? []
    for (const token of tokens) {
      const digest = createHash('sha256').update(token).digest()
      for (let offset = 0; offset < digest.length; offset += 4) {
        const index = digest.readUInt32BE(offset) % RAG_EMBEDDING_DIMENSIONS
        const sign = digest[offset]! % 2 === 0 ? 1 : -1
        vector[index] = (vector[index] ?? 0) + sign
      }
    }
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
    return magnitude ? vector.map((value) => value / magnitude) : vector
  }

  async embedMany(texts: string[]) { return Promise.all(texts.map((text) => this.embed(text))) }
}

class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider {
  private readonly endpoint: string
  private readonly model: string
  private readonly apiKey?: string

  constructor(endpoint: string, model: string, apiKey?: string) {
    this.endpoint = endpoint
    this.model = model
    this.apiKey = apiKey
  }

  get id() { return this.model }
  get name() { return `OpenAI-compatible embeddings (${this.model})` }
  getDimensions() { return RAG_EMBEDDING_DIMENSIONS }
  isConfigured() { return Boolean(this.endpoint && this.model) }

  async embed(text: string) {
    const [embedding] = await this.embedMany([text])
    return embedding ?? []
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}) },
      body: JSON.stringify({ model: this.model, input: texts, dimensions: RAG_EMBEDDING_DIMENSIONS }),
    })
    if (!response.ok) throw new Error(`Falha no endpoint de embeddings: HTTP ${response.status}`)
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data?: unknown }).data)) throw new Error('Resposta de embeddings inválida')
    const data = (payload as { data: Array<{ index?: number; embedding?: unknown }> }).data
    return data.slice().sort((left, right) => (left.index ?? 0) - (right.index ?? 0)).map((item) => {
      if (!Array.isArray(item.embedding)) throw new Error('Resposta de embeddings sem vetor')
      return item.embedding.map(Number)
    })
  }
}

export function createRagEmbeddingService(env: NodeJS.ProcessEnv = process.env): EmbeddingService {
  const endpoint = env.RAG_EMBEDDING_ENDPOINT?.trim()
  const model = env.RAG_EMBEDDING_MODEL?.trim()
  const version = env.RAG_EMBEDDING_VERSION?.trim() || 'v1'
  if (endpoint) {
    const configuredModel = model || 'embedding-768'
    return new EmbeddingService(new OpenAiCompatibleEmbeddingProvider(endpoint, configuredModel, env.RAG_EMBEDDING_API_KEY?.trim() || undefined), { modelName: configuredModel, modelVersion: version })
  }
  if (env.AI_EMBEDDING_LOCAL_FALLBACK_ENABLED === 'false') throw new Error('Nenhum provedor de embeddings 768d está configurado')
  return new EmbeddingService(new LocalHashEmbeddingProvider(), { modelName: 'local-hash-768', modelVersion: version })
}
