import type { QueryResult, QueryResultRow } from 'pg'

export const RAG_EMBEDDING_DIMENSIONS = 768

export interface VectorUpsertInput {
  chunkId: string
  modelName: string
  modelVersion: string
  embedding: number[]
  metadata: Record<string, unknown>
  contentHash: string
}

export interface VectorSearchInput {
  embedding: number[]
  limit?: number
  metadata?: Record<string, unknown>
}

export interface VectorSearchResult {
  chunkId: string
  modelName: string
  modelVersion: string
  metadata: Record<string, unknown>
  contentHash: string
  similarity: number
}

export interface IVectorStore {
  upsert(input: VectorUpsertInput): Promise<void>
  search(input: VectorSearchInput): Promise<VectorSearchResult[]>
  deleteByDocument(documentId: string): Promise<void>
}

export interface PgVectorClient {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>
}

function vectorLiteral(embedding: number[]): string {
  if (embedding.length !== RAG_EMBEDDING_DIMENSIONS) {
    throw new Error(`RAG embedding deve ter ${RAG_EMBEDDING_DIMENSIONS} dimensões; recebido ${embedding.length}`)
  }
  if (embedding.some((value) => !Number.isFinite(value))) {
    throw new Error('RAG embedding contém valor não finito')
  }
  return `[${embedding.join(',')}]`
}

function normalizedLimit(limit: number | undefined): number {
  const value = limit ?? 10
  if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error('O limite da busca vetorial deve estar entre 1 e 100')
  return value
}

export class PgVectorStore implements IVectorStore {
  private readonly client: PgVectorClient

  constructor(client: PgVectorClient) {
    this.client = client
  }

  async upsert(input: VectorUpsertInput): Promise<void> {
    const embedding = vectorLiteral(input.embedding)
    await this.client.query(
      `INSERT INTO rag_embeddings (chunk_id, model_name, model_version, embedding, metadata, content_hash)
       VALUES ($1::uuid, $2, $3, $4::vector, $5::jsonb, $6)
       ON CONFLICT (chunk_id, model_name, model_version) DO UPDATE SET
         embedding = EXCLUDED.embedding,
         metadata = EXCLUDED.metadata,
         content_hash = EXCLUDED.content_hash,
         updated_at = now()`,
      [input.chunkId, input.modelName, input.modelVersion, embedding, JSON.stringify(input.metadata), input.contentHash],
    )
  }

  async search(input: VectorSearchInput): Promise<VectorSearchResult[]> {
    const embedding = vectorLiteral(input.embedding)
    const limit = normalizedLimit(input.limit)
    const metadata = JSON.stringify(input.metadata ?? {})
    const result = await this.client.query<{
      chunk_id: string
      model_name: string
      model_version: string
      metadata: Record<string, unknown>
      content_hash: string
      similarity: number | string
    }>(
      `SELECT e.chunk_id, e.model_name, e.model_version, e.metadata, e.content_hash,
              1 - (e.embedding <=> $1::vector) AS similarity
         FROM rag_embeddings e
        WHERE e.metadata @> $2::jsonb
        ORDER BY e.embedding <=> $1::vector
        LIMIT $3`,
      [embedding, metadata, limit],
    )
    return result.rows.map((row) => ({
      chunkId: row.chunk_id,
      modelName: row.model_name,
      modelVersion: row.model_version,
      metadata: row.metadata ?? {},
      contentHash: row.content_hash,
      similarity: Number(row.similarity),
    }))
  }

  async deleteByDocument(documentId: string): Promise<void> {
    await this.client.query(
      `DELETE FROM rag_embeddings e
        USING knowledge_chunks c
        WHERE e.chunk_id = c.id AND c.document_id = $1::uuid`,
      [documentId],
    )
  }
}
