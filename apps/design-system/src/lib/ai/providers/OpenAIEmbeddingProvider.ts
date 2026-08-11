import type { EmbeddingProvider } from './types'

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  id = 'openai-embedding'; name = 'OpenAI Embeddings'
  private apiKey: string; private model: string; private baseUrl: string
  constructor(apiKey: string, model = 'text-embedding-3-small', baseUrl = 'https://api.openai.com/v1') { this.apiKey = apiKey; this.model = model; this.baseUrl = baseUrl }
  isConfigured() { return this.apiKey.trim().length > 0 }
  getDimensions() { return 1536 }
  async embed(text: string) { return (await this.embedMany([text]))[0] ?? [] }
  async embedMany(texts: string[]) {
    if (!this.isConfigured()) throw new Error('A chave de embeddings da OpenAI não está configurada.')
    const response = await fetch(`${this.baseUrl}/embeddings`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` }, body: JSON.stringify({ model: this.model, input: texts }) })
    if (!response.ok) throw new Error(`OpenAI embeddings error: ${response.status}`)
    const data = await response.json() as { data: Array<{ embedding: number[]; index: number }> }
    return data.data.sort((a, b) => a.index - b.index).map((item) => item.embedding)
  }
}
