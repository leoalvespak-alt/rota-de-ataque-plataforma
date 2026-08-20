import { Hono } from 'hono'
import { db } from '../db'
import { aiTokenLogs } from '@/db/schema'
import { desc, sql, gte, eq } from 'drizzle-orm'

export const tokenLogRoutes = new Hono()
  .get('/', async (c) => {
    const period = c.req.query('period') ?? 'total'
    const model = c.req.query('model')

    let since: Date | null = null
    const now = new Date()
    if (period === '24h') since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    else if (period === '7d') since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    else if (period === '30d') since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const conditions = []
    if (since) conditions.push(gte(aiTokenLogs.createdAt, since))
    if (model) conditions.push(eq(aiTokenLogs.model, model))

    const where = conditions.length > 0
      ? sql`${sql.join(conditions.map(c => sql`${c}`), sql` AND `)}`
      : undefined

    const rows = await db.select().from(aiTokenLogs)
      .where(where)
      .orderBy(desc(aiTokenLogs.createdAt))
      .limit(500)

    return c.json(rows)
  })
  .get('/summary', async (c) => {
    const period = c.req.query('period') ?? 'total'

    let since: Date | null = null
    const now = new Date()
    if (period === '24h') since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    else if (period === '7d') since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    else if (period === '30d') since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const whereClause = since ? gte(aiTokenLogs.createdAt, since) : undefined

    const [summary] = await db.select({
      totalInputTokens: sql<number>`COALESCE(SUM(${aiTokenLogs.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`COALESCE(SUM(${aiTokenLogs.outputTokens}), 0)`,
      totalTokens: sql<number>`COALESCE(SUM(${aiTokenLogs.totalTokens}), 0)`,
      totalCostUsd: sql<string>`COALESCE(SUM(${aiTokenLogs.costUsd}), 0)`,
      totalRequests: sql<number>`COUNT(*)`,
    }).from(aiTokenLogs).where(whereClause)

    const byModel = await db.select({
      model: aiTokenLogs.model,
      provider: aiTokenLogs.provider,
      totalTokens: sql<number>`COALESCE(SUM(${aiTokenLogs.totalTokens}), 0)`,
      totalCostUsd: sql<string>`COALESCE(SUM(${aiTokenLogs.costUsd}), 0)`,
      requests: sql<number>`COUNT(*)`,
    }).from(aiTokenLogs)
      .where(whereClause)
      .groupBy(aiTokenLogs.model, aiTokenLogs.provider)

    return c.json({ summary, byModel })
  })
  .post('/', async (c) => {
    const body = await c.req.json()
    const [row] = await db.insert(aiTokenLogs).values({
      model: body.model,
      provider: body.provider,
      operation: body.operation,
      inputTokens: body.inputTokens ?? 0,
      outputTokens: body.outputTokens ?? 0,
      totalTokens: (body.inputTokens ?? 0) + (body.outputTokens ?? 0),
      costUsd: body.costUsd ?? '0',
      metadata: body.metadata,
    }).returning()
    return c.json(row, 201)
  })
