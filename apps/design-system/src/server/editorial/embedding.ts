import type { EmbeddingProvider } from '@/lib/ai/providers/types'

export class EmbeddingService {
  private provider: EmbeddingProvider
  constructor(provider: EmbeddingProvider) { this.provider = provider }
  embedText(text: string) { return this.provider.embed(text) }
  async embedMany(texts: string[]) { return this.provider.embedMany ? this.provider.embedMany(texts) : Promise.all(texts.map((text) => this.provider.embed(text))) }
  async embedChunks<T extends { content: string }>(chunks: T[]) { const embeddings = await this.embedMany(chunks.map((chunk) => chunk.content)); return chunks.map((chunk, index) => ({ chunk, embedding: embeddings[index] ?? [] })) }
}
