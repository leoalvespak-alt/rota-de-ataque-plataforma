import { Hono } from 'hono'
import { createThesisSchema, structureThesisSchema } from '@/domain/editorial/schemas'
import { body, slugify } from './helpers'
import { db } from '../db'
import { editorialTheses } from '@/db/editorial-schema'

export const thesisStructurerRoutes = new Hono()
thesisStructurerRoutes.post('/structure', async (c) => { const { text } = await body(c, structureThesisSchema); const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean); const title = sentences[0]?.slice(0, 90) || 'Nova tese'; return c.json({ title, summary: sentences.slice(0, 2).join(' '), coreStatement: sentences[0] ?? text.slice(0, 180), fullText: text, arguments: sentences.slice(1, 4).map((content, index) => ({ type: index === 0 ? 'primary' : 'secondary', title: `Argumento ${index + 1}`, content, position: index })), objections: [], examples: [], tags: [] }) })
thesisStructurerRoutes.post('/structure/apply', async (c) => { const input = await body(c, createThesisSchema); const [created] = await db.insert(editorialTheses).values({ ...input, slug: input.slug ?? slugify(input.title) }).returning(); return c.json(created, 201) })
