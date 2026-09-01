import { describe, expect, it, vi } from 'vitest'
import { PgVectorStore, RAG_EMBEDDING_DIMENSIONS } from './pg-vector-store'

const embedding = Array.from({ length: RAG_EMBEDDING_DIMENSIONS }, (_, index) => index / RAG_EMBEDDING_DIMENSIONS)

describe('PgVectorStore', () => {
  it('valida dimensão e valores do embedding', async () => {
    const client = { query: vi.fn() }
    const store = new PgVectorStore(client)
    await expect(store.upsert({ chunkId: '00000000-0000-0000-0000-000000000001', modelName: 'rag', modelVersion: 'v1', embedding: [1], metadata: {}, contentHash: 'hash' })).rejects.toThrow('768 dimensões')
    await expect(store.search({ embedding: embedding.map(() => Number.NaN) })).rejects.toThrow('não finito')
    expect(client.query).not.toHaveBeenCalled()
  })

  it('faz upsert idempotente e busca com filtro metadata', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [{ chunk_id: 'chunk', model_name: 'rag', model_version: 'v1', metadata: { thesisId: 'thesis' }, content_hash: 'hash', similarity: '0.91' }] }) }
    const store = new PgVectorStore(client)
    await store.upsert({ chunkId: '00000000-0000-0000-0000-000000000001', modelName: 'rag', modelVersion: 'v1', embedding, metadata: { thesisId: 'thesis' }, contentHash: 'hash' })
    const results = await store.search({ embedding, limit: 5, metadata: { thesisId: 'thesis' } })
    expect(client.query).toHaveBeenCalledTimes(2)
    expect(client.query.mock.calls[0]?.[0]).toContain('ON CONFLICT (chunk_id, model_name, model_version)')
    expect(client.query.mock.calls[1]?.[0]).toContain('ORDER BY e.embedding <=> $1::vector')
    expect(results).toEqual([{ chunkId: 'chunk', modelName: 'rag', modelVersion: 'v1', metadata: { thesisId: 'thesis' }, contentHash: 'hash', similarity: 0.91 }])
  })

  it('rejeita limites de busca fora da faixa segura', async () => {
    const store = new PgVectorStore({ query: vi.fn() })
    await expect(store.search({ embedding, limit: 101 })).rejects.toThrow('entre 1 e 100')
  })
})
