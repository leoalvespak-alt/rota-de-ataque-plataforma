import { describe, expect, it } from 'vitest'
import type { EmbeddingProvider } from '@/lib/ai/providers/types'
import { RAG_EMBEDDING_DIMENSIONS } from './pg-vector-store'
import { EmbeddingService, LocalHashEmbeddingProvider, createRagEmbeddingService } from './embedding'

describe('embeddings documentais', () => {
  it('produz fallback local determinístico em 768 dimensões', async () => {
    const provider = new LocalHashEmbeddingProvider()
    const first = await provider.embed('concurso público e estratégia')
    const second = await provider.embed('concurso público e estratégia')
    expect(first).toHaveLength(RAG_EMBEDDING_DIMENSIONS)
    expect(first).toEqual(second)
    expect(first.some((value) => value !== 0)).toBe(true)
  })

  it('valida a dimensão retornada por qualquer provider', async () => {
    const provider: EmbeddingProvider = {
      id: 'invalid',
      name: 'invalid',
      embed: async () => [1],
      isConfigured: () => true,
    }
    const service = new EmbeddingService(provider, { modelName: 'invalid', modelVersion: 'v1' })
    await expect(service.embedText('texto')).rejects.toThrow('768 dimensões')
  })

  it('mantém fallback sem endpoint e permite desativá-lo explicitamente', () => {
    expect(createRagEmbeddingService({ AI_EMBEDDING_LOCAL_FALLBACK_ENABLED: 'true' }).model).toEqual({ modelName: 'local-hash-768', modelVersion: 'v1' })
    expect(() => createRagEmbeddingService({ AI_EMBEDDING_LOCAL_FALLBACK_ENABLED: 'false' })).toThrow('Nenhum provedor')
  })
})
