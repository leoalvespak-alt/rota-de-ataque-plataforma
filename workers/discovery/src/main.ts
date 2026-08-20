import { createDatabase } from '@plataforma/db'
import { ExaClient } from '@plataforma/exa-api'
import { ApifyClient } from '@plataforma/apify-api'
import { BrightDataClient } from '@plataforma/bright-data-api'
import { logicalEntityKey, observationSchema, robustOutlier, type ProviderObservation } from '@plataforma/organic-intelligence'
import { runWorker } from '@plataforma/queue/runtime'
import { createDiscoveryProcessor, spec, type DiscoveryPayload, type DiscoveryProvider, type DiscoveryRepository, type ProviderPlan } from './index.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const exa = new ExaClient(process.env.EXA_API_KEY ?? '')
const apify = new ApifyClient(process.env.APIFY_API_TOKEN ?? '')
const brightData = new BrightDataClient(process.env.BRIGHT_DATA_API_KEY ?? '', process.env.BRIGHT_DATA_DATASET_ID ?? '')
const { pool } = createDatabase(databaseUrl)

const provider: DiscoveryProvider = {
  plan(payload) {
    if (payload.mode === 'web_search') {
      if (process.env.EXA_ENABLED !== 'true' || !exa.isConfigured()) throw Object.assign(new Error('Exa is disabled or not configured'), { reasonCode: 'PROVIDER_NOT_CONFIGURED' })
      return { provider: 'exa', operation: 'search', estimatedUsd: Math.max(.01, (payload.limit ?? 10) * .002) }
    }
    if (payload.mode === 'social_collect') {
      const actorId = process.env[`APIFY_${payload.platform.toUpperCase()}_ACTOR_ID`] ?? ''
      if (process.env.APIFY_ENABLED !== 'true' || !apify.isConfigured() || !actorId) throw Object.assign(new Error('Apify actor is disabled or not configured'), { reasonCode: 'PROVIDER_NOT_CONFIGURED' })
      return { provider: 'apify', operation: `${payload.platform}.collect`, estimatedUsd: Math.max(.02, payload.urls.length * .005) }
    }
    if (process.env.BRIGHT_DATA_ENABLED !== 'true' || !brightData.isConfigured()) throw Object.assign(new Error('Bright Data is disabled or not configured'), { reasonCode: 'PROVIDER_NOT_CONFIGURED' })
    return { provider: 'bright_data', operation: `${payload.platform}.fallback`, estimatedUsd: Math.max(.01, payload.urls.length * .003), fallbackReason: payload.fallbackReason }
  },
  async discover(payload, signal) {
    const started = Date.now()
    if (payload.mode === 'web_search') {
      const response = await exa.search({ query: payload.query, limit: payload.limit, signal })
      const observations: ProviderObservation[] = response.results.map((item) => ({ provider: 'exa', platform: 'web', externalId: item.id, canonicalUrl: item.url, authorExternalId: item.author ?? undefined, title: item.title, text: item.text ?? undefined, metrics: { score: item.score ?? null }, observedAt: new Date().toISOString(), publishedAt: item.publishedDate ?? null, rawSchemaVersion: 'exa-search-v1' }))
      const estimatedUsd = Math.max(.01, observations.length * .002)
      return { observations, estimatedUsd, actualUsd: null, externalReference: response.requestId, attempts: 1, durationMs: Date.now() - started }
    }
    if (payload.mode === 'social_collect') {
      const actorId = process.env[`APIFY_${payload.platform.toUpperCase()}_ACTOR_ID`]!
      const schemaVersion = process.env.APIFY_ACTOR_SCHEMA_VERSION ?? '1'
      const run = await apify.start({ actorId, schemaVersion }, { startUrls: payload.urls.map((url) => ({ url })), maxItems: payload.limit ?? 100 }, { signal })
      const terminal = await poll(async () => (await apify.status(run.data.id, signal)).data, (value) => ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(value.status), signal)
      if (terminal.status !== 'SUCCEEDED' || !terminal.defaultDatasetId) throw new Error(`APIFY_RUN_${terminal.status}`)
      const rows = await apify.dataset(terminal.defaultDatasetId, signal)
      const observations = rows.flatMap((row, index) => normalizeRecord(row, { provider: 'apify', platform: payload.platform, schemaVersion, index }))
      return { observations, estimatedUsd: Math.max(.02, rows.length * .001), actualUsd: null, externalReference: run.data.id, attempts: 1, durationMs: Date.now() - started }
    }
    const trigger = await brightData.collect({ urls: payload.urls, reason: payload.fallbackReason, signal })
    if (!trigger.snapshot_id) throw new Error('BRIGHT_DATA_SNAPSHOT_MISSING')
    await poll(() => brightData.status(trigger.snapshot_id!, signal), (value) => ['ready', 'failed'].includes(String(value.status).toLowerCase()), signal)
    const rows = await brightData.data(trigger.snapshot_id, signal)
    const observations = rows.flatMap((row, index) => normalizeRecord(row, { provider: 'bright_data', platform: payload.platform, schemaVersion: 'bright-data-v1', index }))
    return { observations, estimatedUsd: Math.max(.01, rows.length * .001), actualUsd: null, externalReference: trigger.snapshot_id, attempts: 1, durationMs: Date.now() - started }
  },
}

const repository: DiscoveryRepository = {
  async start(payload, traceId, plan) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const budget = (await client.query<{ id: string }>(`SELECT id FROM organic_budgets WHERE hard_limit AND period='daily' AND period_started_at::date=current_date
        AND (scope='global' OR (scope='provider' AND scope_id=$1) OR (scope='campaign' AND scope_id=$2)) AND spent_usd+reserved_usd+$3<=limit_usd
        ORDER BY CASE scope WHEN 'campaign' THEN 0 WHEN 'provider' THEN 1 ELSE 2 END LIMIT 1 FOR UPDATE`, [plan.provider, payload.campaignId, plan.estimatedUsd])).rows[0]
      if (!budget) throw Object.assign(new Error('Organic daily budget missing or blocked'), { reasonCode: 'BUDGET_BLOCKED' })
      const run = (await client.query<{ id: string }>(`INSERT INTO research_runs(campaign_id,purpose,status,correlation_id,provider_plan,parameters,started_at)
        VALUES($1,'discovery','running',$2,$3::jsonb,$4::jsonb,now()) RETURNING id`, [payload.campaignId, traceId, JSON.stringify([plan]), JSON.stringify(payload)])).rows[0]!
      const reservation = (await client.query<{ id: string }>(`INSERT INTO organic_budget_reservations(provider,budget_id,research_run_id,estimated_usd) VALUES($1,$2,$3,$4) RETURNING id`, [plan.provider, budget.id, run.id, plan.estimatedUsd])).rows[0]!
      await client.query('UPDATE organic_budgets SET reserved_usd=reserved_usd+$2 WHERE id=$1', [budget.id, plan.estimatedUsd])
      await client.query('COMMIT')
      return { runId: run.id, reservationId: reservation.id }
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  },
  async complete(runId, reservationId, plan, result, traceId) {
    const client = await pool.connect(); let inserted = 0, candidates = 0
    try {
      await client.query('BEGIN')
      for (const observation of result.observations) {
        const entityKey = logicalEntityKey(observation)
        const saved = await client.query<{ id: string }>(`INSERT INTO provider_observations(research_run_id,provider,platform,external_id,canonical_url,logical_entity_key,author_external_id,title,text_content,metrics,raw_schema_version,observed_at,published_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING RETURNING id`, [runId, observation.provider, observation.platform, observation.externalId, observation.canonicalUrl, logicalEntityKey(observation), observation.authorExternalId ?? null, observation.title ?? null, observation.text ?? null, JSON.stringify(observation.metrics), observation.rawSchemaVersion, observation.observedAt, observation.publishedAt ?? null])
        if (!saved.rowCount) continue
        inserted += 1
        const entity = (await client.query<{ id: string }>(`INSERT INTO cross_platform_entities(kind,canonical_key,display_name,confidence,status) VALUES('content',$1,$2,.5,'candidate') ON CONFLICT(canonical_key) DO UPDATE SET updated_at=now() RETURNING id`, [entityKey, observation.title ?? observation.canonicalUrl])).rows[0]!
        await client.query(`INSERT INTO cross_platform_profiles(entity_id,platform,external_id,handle,canonical_url,provenance_observation_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(platform,external_id) DO UPDATE SET provenance_observation_id=EXCLUDED.provenance_observation_id,canonical_url=EXCLUDED.canonical_url`, [entity.id, observation.platform, observation.externalId, observation.authorExternalId ?? null, observation.canonicalUrl, saved.rows[0]!.id])
        const views = observation.metrics.views
        if (typeof views === 'number') {
          await client.query(`INSERT INTO content_metric_snapshots(observation_id,captured_at,views,likes,comments,shares,saves,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(observation_id,captured_at) DO NOTHING`, [saved.rows[0]!.id, observation.observedAt, views, observation.metrics.likes ?? null, observation.metrics.comments ?? null, observation.metrics.shares ?? null, observation.metrics.saves ?? null, observation.provider])
          const baseline = (await client.query<{ views: string }>(`SELECT metrics->>'views' views FROM provider_observations WHERE platform=$1 AND author_external_id IS NOT DISTINCT FROM $2 AND metrics ? 'views' AND id<>$3 ORDER BY observed_at DESC LIMIT 50`, [observation.platform, observation.authorExternalId ?? null, saved.rows[0]!.id])).rows.map((row) => Number(row.views)).filter(Number.isFinite)
          const outlier = robustOutlier(baseline, views)
          await client.query(`INSERT INTO organic_intelligence_signals(observation_id,entity_id,signal_type,value,evidence_ids,score_version,confidence) VALUES($1,$2,'relative_outlier',$3::jsonb,ARRAY[$1]::uuid[],'mad-v1',$4)`, [saved.rows[0]!.id, entity.id, JSON.stringify({ score: outlier.score, baselineSize: baseline.length, metric: 'views' }), outlier.confidence])
        }
        const identity = observation.authorExternalId ?? new URL(observation.canonicalUrl).hostname.replace(/^www\./, '')
        const candidate = await client.query<{ id: string }>(`INSERT INTO candidate_sources(username_candidate,discovered_via,relevance_score,evidence,status) VALUES($1,$2,$3,$4::jsonb,'new') RETURNING id`, [identity, plan.provider, Math.max(0, Math.min(1, Number(observation.metrics.score ?? .5))), JSON.stringify({ observationId: saved.rows[0]!.id, platform: observation.platform, url: observation.canonicalUrl, traceId })])
        if (candidate.rowCount) {
          candidates += 1
          await client.query(`INSERT INTO review_inbox(item_type,item_ref_id,reason,suggested_action,context) VALUES('candidate_source',$1,'Fonte descoberta requer validação humana',$2::jsonb,$3::jsonb)`, [candidate.rows[0]!.id, JSON.stringify({ action: 'validate_source' }), JSON.stringify({ provider: plan.provider, observationId: saved.rows[0]!.id })])
        }
      }
      const charged = result.actualUsd ?? result.estimatedUsd
      await client.query(`INSERT INTO provider_usage(research_run_id,provider,operation,units,estimated_cost_usd,actual_cost_usd,duration_ms,attempts,outcome,fallback_reason,external_reference,pricing_version)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'completed',$9,$10,'provider-estimate-v1')`, [runId, plan.provider, plan.operation, result.observations.length, result.estimatedUsd, result.actualUsd, result.durationMs ?? null, result.attempts ?? 1, plan.fallbackReason ?? null, result.externalReference ?? null])
      await client.query(`UPDATE organic_budgets budget SET reserved_usd=GREATEST(0,reserved_usd-reservation.estimated_usd),spent_usd=spent_usd+$2 FROM organic_budget_reservations reservation WHERE reservation.id=$1 AND reservation.budget_id=budget.id`, [reservationId, charged])
      await client.query(`UPDATE organic_budget_reservations SET actual_usd=$2,status='reconciled',reconciled_at=now() WHERE id=$1`, [reservationId, result.actualUsd])
      await client.query(`UPDATE research_runs SET status='completed',finished_at=now() WHERE id=$1`, [runId])
      await client.query('COMMIT'); return { inserted, candidates }
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  },
  async fail(runId, reservationId, error) {
    await pool.query(`WITH reservation AS (UPDATE organic_budget_reservations SET status='refunded',reconciled_at=now() WHERE id=$1 AND status='reserved' RETURNING budget_id,estimated_usd) UPDATE organic_budgets budget SET reserved_usd=GREATEST(0,budget.reserved_usd-reservation.estimated_usd) FROM reservation WHERE budget.id=reservation.budget_id`, [reservationId])
    await pool.query(`UPDATE research_runs SET status='failed',error_code=$2,finished_at=now() WHERE id=$1`, [runId, error instanceof Error ? error.message.slice(0, 120) : 'UNKNOWN'])
  },
}

function normalizeRecord(row: Record<string, unknown>, context: { provider: 'apify' | 'bright_data'; platform: 'instagram' | 'tiktok' | 'youtube' | 'web' | 'x' | 'google'; schemaVersion: string; index: number }): ProviderObservation[] {
  const url = firstString(row.url, row.canonicalUrl, row.postUrl, row.videoUrl)
  if (!url) return []
  const value = { provider: context.provider, platform: context.platform, externalId: firstString(row.id, row.shortCode, row.videoId) ?? `${context.index}:${url}`, canonicalUrl: url, authorExternalId: firstString(row.authorId, row.ownerUsername, row.channelId, row.handle), title: firstString(row.title), text: firstString(row.text, row.caption, row.description), metrics: numericMetrics(row), observedAt: new Date().toISOString(), publishedAt: isoDate(row.publishedAt ?? row.timestamp ?? row.uploadDate), rawSchemaVersion: context.schemaVersion }
  const parsed = observationSchema.safeParse(value)
  return parsed.success ? [parsed.data] : []
}
const firstString = (...values: unknown[]) => values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)
const isoDate = (value: unknown) => { if (typeof value !== 'string' && typeof value !== 'number') return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString() }
const numericMetrics = (row: Record<string, unknown>) => Object.fromEntries(['views', 'likes', 'comments', 'shares', 'saves', 'followers', 'score'].flatMap((key) => typeof row[key] === 'number' && Number.isFinite(row[key]) ? [[key, row[key] as number]] : []))
async function poll<T>(load: () => Promise<T>, terminal: (value: T) => boolean, signal?: AbortSignal): Promise<T> { for (let attempt = 0; attempt < 60; attempt += 1) { signal?.throwIfAborted(); const value = await load(); if (terminal(value)) return value; await new Promise((resolve) => setTimeout(resolve, 2_000)) } throw new Error('PROVIDER_POLL_TIMEOUT') }

runWorker(spec.queue, createDiscoveryProcessor(repository, provider))
