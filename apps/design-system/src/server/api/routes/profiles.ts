import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { brandProfiles } from '@/db/schema'
import { db } from '../db'
import { body, notFound, slugify } from './helpers'

const profileSchema = z.object({
  name: z.string().min(1).max(255),
  handle: z.string().min(1).max(100),
  colorBackground: z.string().regex(/^#[0-9A-Fa-f]{6,8}$/),
  colorText: z.string().regex(/^#[0-9A-Fa-f]{6,8}$/),
  colorPrimary: z.string().regex(/^#[0-9A-Fa-f]{6,8}$/),
  colorButton: z.string().regex(/^#[0-9A-Fa-f]{6,8}$/),
  fontHeading: z.string().max(255).default('Rajdhani'),
  fontBody: z.string().max(255).default('IBM Plex Sans'),
  avatarKey: z.string().max(1000).optional(),
})

const updateProfileSchema = profileSchema.partial()

export const profileRoutes = new Hono()

profileRoutes.get('/', async (c) => {
  const rows = await db.select().from(brandProfiles).orderBy(brandProfiles.createdAt)
  return c.json(rows)
})

profileRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const [profile] = await db.select().from(brandProfiles).where(eq(brandProfiles.id, id))
  if (!profile) notFound('Perfil')
  return c.json(profile)
})

profileRoutes.post('/', async (c) => {
  const input = await body(c, profileSchema)
  const handle = input.handle.startsWith('@') ? input.handle : `@${input.handle}`
  const slug = slugify(input.name)
  const [created] = await db.insert(brandProfiles).values({ ...input, handle, slug }).returning()
  return c.json(created, 201)
})

profileRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  const [existing] = await db.select().from(brandProfiles).where(eq(brandProfiles.id, id))
  if (!existing) notFound('Perfil')
  const input = await body(c, updateProfileSchema)
  const handle = input.handle
    ? input.handle.startsWith('@') ? input.handle : `@${input.handle}`
    : undefined
  const [updated] = await db
    .update(brandProfiles)
    .set({ ...input, ...(handle ? { handle } : {}), updatedAt: new Date() })
    .where(eq(brandProfiles.id, id))
    .returning()
  return c.json(updated)
})

profileRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const [existing] = await db.select().from(brandProfiles).where(eq(brandProfiles.id, id))
  if (!existing) notFound('Perfil')
  if (existing!.isDefault) {
    return c.json({ error: 'O perfil padrão não pode ser deletado.' }, 400)
  }
  await db.delete(brandProfiles).where(eq(brandProfiles.id, id))
  return c.json({ ok: true })
})
