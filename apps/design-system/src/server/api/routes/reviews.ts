import { desc, eq } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { contentItems, contentReviews, contentVersions } from '@/db/editorial-schema'
import { createReviewSchema } from '@/domain/editorial/schemas'
import { db } from '../db'
import { body, notFound } from './helpers'

export const reviewRoutes = new Hono()

const getContentId = (c: Context): string => {
  const id = c.req.param('contentId')
  if (!id) notFound('Conteúdo')
  return id
}

reviewRoutes.get('/pending', async (c) =>
  c.json(
    await db
      .select()
      .from(contentItems)
      .where(eq(contentItems.status, 'ready_for_approval'))
      .orderBy(desc(contentItems.updatedAt)),
  ),
)

async function review(c: Context, action: 'approve' | 'reject' | 'request_revision') {
  const input = await body(c, createReviewSchema)
  const id = getContentId(c)
  const [content] = await db.select().from(contentItems).where(eq(contentItems.id, id))
  if (!content) notFound('Conteúdo')

  await db.insert(contentReviews).values({
    contentItemId: id,
    reviewer: input.reviewer ?? 'editor',
    action,
    reasonCode: input.reasonCode,
    comment: input.comment,
  })

  const status =
    action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'needs_revision'
  const [updated] = await db
    .update(contentItems)
    .set({ status, updatedAt: new Date() })
    .where(eq(contentItems.id, id))
    .returning()
  return c.json(updated)
}

reviewRoutes.post('/:contentId/approve', (c) => review(c, 'approve'))
reviewRoutes.post('/:contentId/reject', (c) => review(c, 'reject'))
reviewRoutes.post('/:contentId/revision', (c) => review(c, 'request_revision'))

reviewRoutes.post('/:contentId/regenerate', async (c) => {
  const id = getContentId(c)
  const [updated] = await db
    .update(contentItems)
    .set({ status: 'generating', updatedAt: new Date() })
    .where(eq(contentItems.id, id))
    .returning()
  if (!updated) notFound('Conteúdo')
  return c.json(updated)
})

reviewRoutes.get('/:contentId/versions', async (c) => {
  const id = getContentId(c)
  return c.json(
    await db
      .select()
      .from(contentVersions)
      .where(eq(contentVersions.contentItemId, id))
      .orderBy(desc(contentVersions.version)),
  )
})

reviewRoutes.post('/:contentId/rollback/:version', async (c) => {
  const id = getContentId(c)
  const versions = await db
    .select()
    .from(contentVersions)
    .where(eq(contentVersions.contentItemId, id))
  const snapshot = versions.find((item) => item.version === Number(c.req.param('version')))
  if (!snapshot) notFound('Versão')
  const [updated] = await db
    .update(contentItems)
    .set({
      copyData: snapshot.copyData,
      templateId: snapshot.templateId,
      version: snapshot.version,
      updatedAt: new Date(),
    })
    .where(eq(contentItems.id, id))
    .returning()
  return c.json(updated)
})
