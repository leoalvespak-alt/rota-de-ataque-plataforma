import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { contentItems, contentUsageLedger, editorialThesisArguments, editorialThesisEvidence, editorialThesisExamples, editorialThesisObjections, editorialThesisRelations, editorialThesisVersions, editorialTheses } from '@/db/editorial-schema'
import { createThesisSchema, updateThesisSchema } from '@/domain/editorial/schemas'
import { db } from '../db'
import { body, notFound, slugify } from './helpers'

export const thesesRoutes = new Hono()
thesesRoutes.get('/', async (c) => { const search = c.req.query('search'); const status = c.req.query('status'); const rows = await db.select().from(editorialTheses).where(and(...(status ? [eq(editorialTheses.status, status)] : []), ...(search ? [ilike(editorialTheses.title, `%${search}%`)] : []))).orderBy(desc(editorialTheses.priority), asc(editorialTheses.title)); const tags = c.req.query('tags')?.split(',').filter(Boolean); return c.json(tags?.length ? rows.filter((row) => tags.every((tag) => row.tags?.includes(tag))) : rows) })
thesesRoutes.get('/:id', async (c) => { const id = c.req.param('id'); const [thesis] = await db.select().from(editorialTheses).where(eq(editorialTheses.id, id)); if (!thesis) notFound('Tese'); const [arguments_, objections, examples, evidence, relations] = await Promise.all([db.select().from(editorialThesisArguments).where(eq(editorialThesisArguments.thesisId, id)).orderBy(editorialThesisArguments.position), db.select().from(editorialThesisObjections).where(eq(editorialThesisObjections.thesisId, id)).orderBy(editorialThesisObjections.position), db.select().from(editorialThesisExamples).where(eq(editorialThesisExamples.thesisId, id)).orderBy(editorialThesisExamples.position), db.select().from(editorialThesisEvidence).where(eq(editorialThesisEvidence.thesisId, id)).orderBy(editorialThesisEvidence.position), db.select().from(editorialThesisRelations).where(eq(editorialThesisRelations.thesisAId, id))]); return c.json({ ...thesis, arguments: arguments_, objections, examples, evidence, relations }) })
thesesRoutes.post('/', async (c) => { const input = await body(c, createThesisSchema); const slug = input.slug ?? slugify(input.title); const [created] = await db.insert(editorialTheses).values({ ...input, slug }).returning(); return c.json(created, 201) })
thesesRoutes.put('/:id', async (c) => { const id = c.req.param('id'); const input = await body(c, updateThesisSchema); const [current] = await db.select().from(editorialTheses).where(eq(editorialTheses.id, id)); if (!current) notFound('Tese'); const { changeReason, ...patch } = input; await db.insert(editorialThesisVersions).values({ thesisId: id, version: current.version, snapshot: current as unknown as Record<string, unknown>, changeReason }); const [updated] = await db.update(editorialTheses).set({ ...patch, ...(patch.title && !patch.slug ? { slug: slugify(patch.title) } : {}), version: current.version + 1, updatedAt: new Date() }).where(eq(editorialTheses.id, id)).returning(); return c.json(updated) })
thesesRoutes.post('/:id/duplicate', async (c) => { const id = c.req.param('id'); const [source] = await db.select().from(editorialTheses).where(eq(editorialTheses.id, id)); if (!source) notFound('Tese'); const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...copy } = source; const [created] = await db.insert(editorialTheses).values({ ...copy, title: `${source.title} (cópia)`, slug: `${source.slug}-${Date.now()}`, status: 'draft', version: 1 }).returning(); return c.json(created, 201) })
thesesRoutes.patch('/:id/status', async (c) => { const status = (await c.req.json() as { status?: string }).status; if (!['draft', 'active', 'archived'].includes(status ?? '')) return c.json({ error: 'Status inválido.' }, 400); const [updated] = await db.update(editorialTheses).set({ status: status!, updatedAt: new Date() }).where(eq(editorialTheses.id, c.req.param('id'))).returning(); if (!updated) notFound('Tese'); return c.json(updated) })
thesesRoutes.get('/:id/usage', async (c) => { const id = c.req.param('id'); const [usage] = await db.select({ count: sql<number>`count(*)::int`, lastUsedAt: sql<string | null>`max(${contentUsageLedger.usedAt})` }).from(contentUsageLedger).where(eq(contentUsageLedger.thesisId, id)); return c.json(usage) })
thesesRoutes.get('/:id/content', async (c) => c.json(await db.select().from(contentItems).where(eq(contentItems.thesisId, c.req.param('id'))).orderBy(desc(contentItems.createdAt))))
thesesRoutes.get('/:id/gaps', async (c) => { const usage = await db.select({ angleId: contentUsageLedger.angleId, count: sql<number>`count(*)::int` }).from(contentUsageLedger).where(eq(contentUsageLedger.thesisId, c.req.param('id'))).groupBy(contentUsageLedger.angleId); return c.json({ usedAngles: usage, message: 'Use esta lista para priorizar ângulos ainda não explorados.' }) })
thesesRoutes.post('/sync', async (c) => {
  const { prospector_thesis_id } = await c.req.json() as { prospector_thesis_id?: string }
  if (!prospector_thesis_id) return c.json({ error: 'Falta prospector_thesis_id' }, 400)

  const prospectorResult = await db.execute(sql`SELECT * FROM theses WHERE id = ${prospector_thesis_id}`)
  const pt = prospectorResult.rows[0] as Record<string, unknown> | undefined
  if (!pt) return c.json({ error: 'Tese não encontrada no Prospector' }, 404)

  const title = String(pt.title || 'Sem título')
  const summary = pt.description ? String(pt.description) : null
  const coreStatement = summary || title
  const slug = slugify(title) + '-p-' + prospector_thesis_id.slice(0, 8)

  const result = await db.execute(sql`
    INSERT INTO editorial_theses (
      prospector_thesis_id, title, slug, summary, core_statement, status, version
    ) VALUES (
      ${prospector_thesis_id},
      ${title},
      ${slug},
      ${summary},
      ${coreStatement},
      'active',
      1
    )
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      prospector_thesis_id = EXCLUDED.prospector_thesis_id,
      updated_at = now()
    RETURNING id
  `)

  return c.json({ message: 'Sincronizado', id: (result.rows[0] as Record<string, unknown>)?.id }, 200)
})
