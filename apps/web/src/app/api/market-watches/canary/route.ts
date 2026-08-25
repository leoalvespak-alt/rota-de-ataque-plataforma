import { createDatabase } from '@plataforma/db'
import { createQueueRegistry, enqueueOnce } from '@plataforma/queue'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse } from '@/lib/api-errors'
import { requireRole } from '@/lib/permissions'

const inputSchema = z.object({
  watchId: z.string().uuid(),
  provider: z.enum(['apify', 'bright_data']),
  limit: z.number().int().min(1).max(10).default(10),
}).strict()

function isConfigured(provider: z.infer<typeof inputSchema>['provider']) {
  const hashSaltReady = Boolean(process.env.DISCOVERY_AUTHOR_HASH_SALT?.trim())
  if (provider === 'apify') return process.env.APIFY_ENABLED === 'true' && hashSaltReady && Boolean(process.env.APIFY_API_TOKEN?.trim() && process.env.APIFY_REDDIT_ACTOR_ID?.trim())
  return process.env.BRIGHT_DATA_ENABLED === 'true' && hashSaltReady && Boolean(process.env.BRIGHT_DATA_API_KEY?.trim() && process.env.BRIGHT_DATA_DATASET_ID?.trim())
}

function watchUrl(kind: string, raw: string) {
  const value = raw.replace(/^r\//iu, '').replace(/^u\//iu, '').trim()
  if (kind === 'subreddit') return `https://www.reddit.com/r/${encodeURIComponent(value)}`
  if (kind === 'user') return `https://www.reddit.com/user/${encodeURIComponent(value)}`
  return `https://www.reddit.com/search/?q=${encodeURIComponent(value)}`
}

export async function POST(request: Request) {
  const traceId = crypto.randomUUID()
  try { await requireRole('operator') } catch (error) { return apiErrorResponse(error) }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', message: parsed.error.issues[0]?.message ?? 'Canário inválido.', traceId }, { status: 400 })
  if (!isConfigured(parsed.data.provider)) return NextResponse.json({ error: 'provider_not_configured', message: 'Configure o provedor externo antes de executar o canário.', traceId }, { status: 409 })

  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const registry = createQueueRegistry(process.env.REDIS_URL!)
  try {
    const row = (await pool.query<{ id: string; campaign_id: string; kind: string; value: string }>(`SELECT id,campaign_id,kind,value FROM market_watches WHERE id=$1 AND platform='reddit'`, [parsed.data.watchId])).rows[0]
    if (!row) return NextResponse.json({ error: 'watch_not_found', traceId }, { status: 404 })
    const url = watchUrl(row.kind, row.value)
    const payload = parsed.data.provider === 'apify'
      ? { mode: 'social_collect' as const, campaignId: row.campaign_id, platform: 'reddit' as const, urls: [url], limit: parsed.data.limit, watchId: row.id }
      : { mode: 'fallback_collect' as const, campaignId: row.campaign_id, platform: 'reddit' as const, urls: [url], limit: parsed.data.limit, fallbackReason: 'validation_sample' as const, watchId: row.id }
    await enqueueOnce(registry.queues.discovery, 'discovery', [row.id, parsed.data.provider], payload)
    return NextResponse.json({ queued: true, canary: true, provider: parsed.data.provider, limit: parsed.data.limit, meta: { traceId, sourceStatus: 'ready' } }, { status: 202 })
  } catch (error) { return apiErrorResponse(error) }
  finally { await registry.queues.discovery.close(); await registry.connection.quit(); await pool.end() }
}
