import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { editorialThesisArguments, editorialThesisEvidence, editorialThesisExamples, editorialThesisObjections, editorialThesisRelations } from '@/db/editorial-schema'
import { createArgumentSchema, createEvidenceSchema, createExampleSchema, createObjectionSchema } from '@/domain/editorial/schemas'
import { db } from '../db'
import { body, notFound } from './helpers'

export const thesisArgumentsRoutes = new Hono()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resourceRoutes(path: string, table: any, schema: any) { thesisArgumentsRoutes.get(`/:thesisId/${path}`, async (c) => c.json(await (db.select().from(table).where(eq(table.thesisId, c.req.param('thesisId'))).orderBy(asc(table.position)) as unknown as Promise<Array<Record<string, unknown>>>))); thesisArgumentsRoutes.post(`/:thesisId/${path}`, async (c) => { const input = await body(c, schema) as Record<string, unknown>; const created = await (db.insert(table).values({ ...input, thesisId: c.req.param('thesisId') }).returning() as unknown as Promise<Array<Record<string, unknown>>>); return c.json(created[0], 201) }); thesisArgumentsRoutes.put(`/${path}/:id`, async (c) => { const input = await body(c, schema.partial()) as Record<string, unknown>; const updated = await (db.update(table).set(input).where(eq(table.id, c.req.param('id'))).returning() as unknown as Promise<Array<Record<string, unknown>>>); if (!updated[0]) notFound(); return c.json(updated[0]) }); thesisArgumentsRoutes.delete(`/${path}/:id`, async (c) => { const result = await (db.delete(table).where(eq(table.id, c.req.param('id'))).returning({ id: table.id }) as unknown as Promise<Array<Record<string, unknown>>>); if (!result.length) notFound(); return c.body(null, 204) }) }
resourceRoutes('arguments', editorialThesisArguments, createArgumentSchema)
resourceRoutes('objections', editorialThesisObjections, createObjectionSchema)
resourceRoutes('examples', editorialThesisExamples, createExampleSchema)
resourceRoutes('evidence', editorialThesisEvidence, createEvidenceSchema)
thesisArgumentsRoutes.get('/:thesisId/relations', async (c) => c.json(await db.select().from(editorialThesisRelations).where(eq(editorialThesisRelations.thesisAId, c.req.param('thesisId')))))
thesisArgumentsRoutes.post('/:thesisId/relations', async (c) => { const input = await c.req.json() as { thesisBId: string; relationType: 'supports' | 'contrasts' | 'extends' | 'requires' }; const [created] = await db.insert(editorialThesisRelations).values({ thesisAId: c.req.param('thesisId'), ...input }).returning(); return c.json(created, 201) })
thesisArgumentsRoutes.delete('/relations/:id', async (c) => { await db.delete(editorialThesisRelations).where(eq(editorialThesisRelations.id, c.req.param('id'))); return c.body(null, 204) })
