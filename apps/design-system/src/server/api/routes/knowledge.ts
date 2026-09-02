import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { knowledgeChunks, knowledgeDocuments } from '@/db/editorial-schema'
import { createDocumentSchema } from '@/domain/editorial/schemas'
import { chunkDocument, contentHash, normalizeText, wordCount } from '@/server/editorial/ingest'
import { createRagEmbeddingService } from '@/server/editorial/embedding'
import { PgVectorStore } from '@/server/editorial/pg-vector-store'
import { searchKnowledge } from '@/server/editorial/search'
import { db, pool } from '../db'
import { body, notFound } from './helpers'

export const knowledgeRoutes = new Hono()
async function indexDocument(document: { id: string; title: string; type: string; contentText: string; thesisId: string | null; tags: string[] | null; language: string }) {
  const chunks = chunkDocument(document.contentText)
  const embeddingService = createRagEmbeddingService()
  const vectorStore = new PgVectorStore(pool)
  const { modelName, modelVersion } = embeddingService.model
  const client = await pool.connect()
  try {
    const existing = await client.query<{ chunk_id: string; chunk_index: number; chunk_hash: string; embedding_hash: string | null }>(
      `SELECT c.id AS chunk_id, c.chunk_index, c.hash AS chunk_hash, e.content_hash AS embedding_hash
         FROM knowledge_chunks c
         LEFT JOIN rag_embeddings e ON e.chunk_id = c.id AND e.model_name = $2 AND e.model_version = $3
        WHERE c.document_id = $1::uuid`,
      [document.id, modelName, modelVersion],
    )
    const existingByIndex = new Map(existing.rows.map((row) => [row.chunk_index, row]))
    const toEmbed = chunks.filter((chunk) => {
      const current = existingByIndex.get(chunk.chunkIndex)
      return !current || current.chunk_hash !== chunk.hash || current.embedding_hash !== chunk.hash
    })
    const embedded = await embeddingService.embedChunks(toEmbed)
    const embeddedByIndex = new Map(embedded.map((entry) => [entry.chunk.chunkIndex, entry.embedding]))
    const metadata = (chunk: typeof chunks[number]) => ({ documentId: document.id, documentTitle: document.title, documentType: document.type, thesisId: document.thesisId, tags: document.tags ?? [], language: document.language, chunkIndex: chunk.chunkIndex, chunkType: chunk.chunkType, sectionPath: chunk.sectionPath })

    await client.query('BEGIN')
    for (const chunk of chunks) {
      const row = (await client.query<{ id: string }>(
        `INSERT INTO knowledge_chunks(document_id,chunk_index,title,content,normalized_content,chunk_type,section_path,tags,thesis_id,language,hash,token_count,version)
         VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8::text[],$9::uuid,$10,$11,$12,1)
         ON CONFLICT(document_id,chunk_index) DO UPDATE SET title=EXCLUDED.title,content=EXCLUDED.content,normalized_content=EXCLUDED.normalized_content,chunk_type=EXCLUDED.chunk_type,section_path=EXCLUDED.section_path,tags=EXCLUDED.tags,thesis_id=EXCLUDED.thesis_id,language=EXCLUDED.language,hash=EXCLUDED.hash,token_count=EXCLUDED.token_count,version=knowledge_chunks.version+1
         RETURNING id`,
        [document.id, chunk.chunkIndex, chunk.title, chunk.content, normalizeText(chunk.content).toLowerCase(), chunk.chunkType, chunk.sectionPath, document.tags ?? [], document.thesisId, document.language, chunk.hash, chunk.tokenCount],
      )).rows[0]
      if (!row) throw new Error(`Não foi possível persistir o chunk ${chunk.chunkIndex}`)
      const embedding = embeddedByIndex.get(chunk.chunkIndex)
      if (embedding) await vectorStore.upsert({ chunkId: row.id, modelName, modelVersion, embedding, metadata: metadata(chunk), contentHash: chunk.hash })
      else await vectorStore.updateMetadata({ chunkId: row.id, modelName, modelVersion, metadata: metadata(chunk), contentHash: chunk.hash })
    }
    await client.query(`DELETE FROM knowledge_chunks WHERE document_id = $1::uuid AND chunk_index >= $2`, [document.id, chunks.length])
    await client.query(`UPDATE knowledge_documents SET status='indexed', updated_at=now() WHERE id=$1::uuid`, [document.id])
    await client.query('COMMIT')
    return chunks.length
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally { client.release() }
}
knowledgeRoutes.get('/documents', async (c) => { const status = c.req.query('status'); const type = c.req.query('type'); const rows = await db.select().from(knowledgeDocuments).where(and(...(status ? [eq(knowledgeDocuments.status, status)] : []), ...(type ? [eq(knowledgeDocuments.type, type)] : []))).orderBy(desc(knowledgeDocuments.updatedAt)); return c.json(rows) })
knowledgeRoutes.post('/documents', async (c) => { const input = await body(c, createDocumentSchema); const [document] = await db.insert(knowledgeDocuments).values({ ...input, contentText: normalizeText(input.contentText), wordCount: wordCount(input.contentText), hash: contentHash(input.contentText), status: 'processing' }).returning(); const chunks = await indexDocument(document!); return c.json({ ...document, status: 'indexed', chunks }, 201) })
knowledgeRoutes.post('/documents/upload', async (c) => { const form = await c.req.formData(); const file = form.get('file'); if (!(file instanceof File)) return c.json({ error: 'Envie um arquivo.' }, 400); const supported = ['text/plain', 'text/markdown', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']; if (!supported.includes(file.type) && !/\.(txt|md|markdown|pdf|docx)$/i.test(file.name)) return c.json({ error: 'Formato não permitido. Use TXT, MD, PDF ou DOCX.' }, 400); if (file.size > 20 * 1024 * 1024) return c.json({ error: 'O arquivo excede 20 MB.' }, 400); const raw = await file.text(); if (!raw.trim()) return c.json({ error: 'Não foi possível extrair texto do arquivo.' }, 422); const title = String(form.get('title') || file.name.replace(/\.[^.]+$/, '')); const tags = String(form.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean); const [document] = await db.insert(knowledgeDocuments).values({ title, type: file.name.endsWith('.md') ? 'markdown' : 'text', originalFilename: file.name, contentText: normalizeText(raw), wordCount: wordCount(raw), hash: contentHash(raw), tags, thesisId: (form.get('thesisId') as string) || null, status: 'processing' }).returning(); const chunks = await indexDocument(document!); return c.json({ ...document, status: 'indexed', chunks }, 201) })
knowledgeRoutes.get('/documents/:id', async (c) => { const id = c.req.param('id'); const [document] = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, id)); if (!document) notFound('Documento'); const chunks = await db.select().from(knowledgeChunks).where(eq(knowledgeChunks.documentId, id)).orderBy(knowledgeChunks.chunkIndex); return c.json({ ...document, chunks }) })
knowledgeRoutes.delete('/documents/:id', async (c) => { const deleted = await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, c.req.param('id'))).returning({ id: knowledgeDocuments.id }); if (!deleted.length) notFound('Documento'); return c.body(null, 204) })
knowledgeRoutes.post('/documents/:id/reindex', async (c) => { const [document] = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, c.req.param('id'))); if (!document) notFound('Documento'); const chunks = await indexDocument(document); return c.json({ id: document.id, status: 'indexed', chunks }) })
knowledgeRoutes.get('/search', async (c) => { const query = c.req.query('q')?.trim(); if (!query) return c.json({ error: 'O parâmetro q é obrigatório.' }, 400); return c.json(await searchKnowledge(query, { thesisId: c.req.query('thesisId'), type: c.req.query('type'), tags: c.req.query('tags')?.split(',').filter(Boolean) })) })
