import { createDatabase } from '@plataforma/db'
import { createQueueRegistry, enqueueOnce } from '@plataforma/queue'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse } from '@/lib/api-errors'
import { getCampaignContext } from '@/lib/campaign-context'
import { getIntegrationCapabilities } from '@/lib/integration-capabilities'
import { requireRole } from '@/lib/permissions'

const inputSchema = z.object({
  campaignId: z.string().uuid().optional(),
  kind: z.enum(['subreddit', 'search_query', 'user', 'keyword_across']),
  value: z.string().trim().min(2).max(500),
  provider: z.enum(['auto', 'apify', 'bright_data']).default('auto'),
  active: z.boolean().default(true),
  limit: z.number().int().min(1).max(10).default(10),
}).superRefine((value, context) => {
  if (value.kind === 'subreddit' && !/^r\/[a-z0-9_-]+$/iu.test(value.value) && !/^[a-z0-9_-]+$/iu.test(value.value)) context.addIssue({ code: 'custom', path: ['value'], message: 'Subreddit inválido.' })
  if (value.kind === 'user' && !/^u\/[a-z0-9_-]+$/iu.test(value.value) && !/^[a-z0-9_-]+$/iu.test(value.value)) context.addIssue({ code: 'custom', path: ['value'], message: 'Usuário inválido.' })
})

function watchUrl(kind: z.infer<typeof inputSchema>['kind'], raw: string) {
  const value = raw.replace(/^r\//iu, '').replace(/^u\//iu, '').trim()
  if (kind === 'subreddit') return `https://www.reddit.com/r/${encodeURIComponent(value)}`
  if (kind === 'user') return `https://www.reddit.com/user/${encodeURIComponent(value)}`
  return `https://www.reddit.com/search/?q=${encodeURIComponent(value)}`
}

function configuredProvider(preference: z.infer<typeof inputSchema>['provider']) {
  const hashSaltReady = Boolean(process.env.DISCOVERY_AUTHOR_HASH_SALT?.trim())
  const apify = process.env.APIFY_ENABLED === 'true' && hashSaltReady && Boolean(process.env.APIFY_API_TOKEN?.trim() && process.env.APIFY_REDDIT_ACTOR_ID?.trim())
  const brightData = process.env.BRIGHT_DATA_ENABLED === 'true' && hashSaltReady && Boolean(process.env.BRIGHT_DATA_API_KEY?.trim() && process.env.BRIGHT_DATA_DATASET_ID?.trim())
  if (preference === 'apify') return apify ? 'apify' as const : null
  if (preference === 'bright_data') return brightData ? 'bright_data' as const : null
  return apify ? 'apify' as const : brightData ? 'bright_data' as const : null
}

export async function GET() {
  try { await requireRole('viewer') } catch (error) { return apiErrorResponse(error) }
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    const [watches, capabilities] = await Promise.all([
      pool.query(`SELECT id,campaign_id,platform,kind,value,provider_preference,active,last_state,reason_code,last_provider,last_cost_usd,last_run_at,next_run_at FROM market_watches WHERE ($1::uuid IS NULL OR campaign_id=$1) ORDER BY active DESC,next_run_at NULLS FIRST,value`, [selected?.id ?? null]),
      getIntegrationCapabilities(pool),
    ])
    return NextResponse.json({ data: watches.rows, provider: capabilities.find((item) => item.id === 'reddit-external') ?? null, meta: { traceId: crypto.randomUUID(), campaignId: selected?.id ?? null, generatedAt: new Date().toISOString(), sourceStatus: 'ready' } })
  } catch (error) { return apiErrorResponse(error) }
}

export async function POST(request: Request) {
  let user: { email?: string | null }
  try { user = await requireRole('operator') } catch (error) { return apiErrorResponse(error) }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', message: parsed.error.issues[0]?.message ?? 'Watch inválido.', traceId: crypto.randomUUID() }, { status: 400 })
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const registry = createQueueRegistry(process.env.REDIS_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    const campaignId = parsed.data.campaignId ?? selected?.id
    if (!campaignId) return NextResponse.json({ error: 'campaign_not_found', traceId: crypto.randomUUID() }, { status: 409 })
    const provider = configuredProvider(parsed.data.provider)
    if (!provider) return NextResponse.json({ error: 'provider_not_configured', message: 'Configure Apify ou Bright Data antes de ativar este watch.', traceId: crypto.randomUUID() }, { status: 409 })
    const row = (await pool.query<{ id: string }>(`INSERT INTO market_watches(campaign_id,platform,kind,value,provider_preference,active,next_run_at,updated_at) VALUES($1,'reddit',$2,$3,$4,$5,now(),now()) ON CONFLICT(platform,kind,value) DO UPDATE SET campaign_id=EXCLUDED.campaign_id,provider_preference=EXCLUDED.provider_preference,active=EXCLUDED.active,next_run_at=now(),updated_at=now() RETURNING id`, [campaignId, parsed.data.kind, parsed.data.value, parsed.data.provider, parsed.data.active])).rows[0]!
    await pool.query(`INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,'market_watch.upsert',$2,$3::jsonb)`, [user.email ?? 'unknown', row.id, JSON.stringify({ ...parsed.data, campaignId, platform: 'reddit' })])
    if (parsed.data.active) {
      const mode = provider === 'bright_data' ? 'fallback_collect' as const : 'social_collect' as const
      const payload = mode === 'social_collect' ? { mode, campaignId, platform: 'reddit' as const, urls: [watchUrl(parsed.data.kind, parsed.data.value)], limit: parsed.data.limit, watchId: row.id } : { mode, campaignId, platform: 'reddit' as const, urls: [watchUrl(parsed.data.kind, parsed.data.value)], limit: parsed.data.limit, fallbackReason: 'primary_not_supported' as const, watchId: row.id }
      await enqueueOnce(registry.queues.discovery, 'discovery', [row.id, mode], payload)
    }
    return NextResponse.json({ id: row.id, queued: parsed.data.active, provider, meta: { traceId: crypto.randomUUID(), sourceStatus: 'ready' } }, { status: 201 })
  } catch (error) { return apiErrorResponse(error) }
  finally { await registry.queues.discovery.close(); await registry.connection.quit() }
}
