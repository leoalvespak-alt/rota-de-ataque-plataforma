import { and, desc, eq, ilike } from 'drizzle-orm'
import { knowledgeChunks, knowledgeDocuments } from '@/db/editorial-schema'
import { db } from '@/server/api/db'

export async function searchKnowledge(query: string, filters: { thesisId?: string; type?: string; tags?: string[] } = {}) {
  const where = and(ilike(knowledgeChunks.normalizedContent, `%${query}%`), ...(filters.thesisId ? [eq(knowledgeChunks.thesisId, filters.thesisId)] : []))
  const rows = await db.select({ chunk: knowledgeChunks, document: knowledgeDocuments }).from(knowledgeChunks).innerJoin(knowledgeDocuments, eq(knowledgeChunks.documentId, knowledgeDocuments.id)).where(where).orderBy(desc(knowledgeChunks.createdAt)).limit(50)
  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean)
  return rows.filter(({ document }) => !filters.type || document.type === filters.type).filter(({ chunk }) => !filters.tags?.length || filters.tags.every((tag) => chunk.tags?.includes(tag))).map(({ chunk, document }) => ({ ...chunk, documentTitle: document.title, score: queryTerms.length ? queryTerms.filter((term) => chunk.normalizedContent.toLowerCase().includes(term)).length / queryTerms.length : 0 })).sort((a, b) => b.score - a.score)
}
