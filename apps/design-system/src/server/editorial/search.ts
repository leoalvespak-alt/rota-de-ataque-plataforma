import { and, eq, inArray } from 'drizzle-orm'
import { knowledgeChunks, knowledgeDocuments } from '@/db/editorial-schema'
import { createRagEmbeddingService } from './embedding'
import { PgVectorStore } from './pg-vector-store'
import { db, pool } from '@/server/api/db'

export async function searchKnowledge(query: string, filters: { thesisId?: string; type?: string; tags?: string[] } = {}) {
  const embeddingService = createRagEmbeddingService()
  const vectorStore = new PgVectorStore(pool)
  const vectorResults = await vectorStore.search({
    embedding: await embeddingService.embedText(query),
    limit: 50,
    metadata: {
      ...(filters.thesisId ? { thesisId: filters.thesisId } : {}),
      ...(filters.type ? { documentType: filters.type } : {}),
      ...(filters.tags?.length ? { tags: filters.tags } : {}),
    },
  })
  if (!vectorResults.length) return []

  const rows = await db.select({ chunk: knowledgeChunks, document: knowledgeDocuments })
    .from(knowledgeChunks)
    .innerJoin(knowledgeDocuments, eq(knowledgeChunks.documentId, knowledgeDocuments.id))
    .where(and(inArray(knowledgeChunks.id, vectorResults.map((result) => result.chunkId))))
  const byId = new Map(rows.map((row) => [row.chunk.id, row]))
  return vectorResults.flatMap((result) => {
    const row = byId.get(result.chunkId)
    return row ? [{ ...row.chunk, documentTitle: row.document.title, score: result.similarity, vectorModel: result.modelName, vectorVersion: result.modelVersion }] : []
  })
}
