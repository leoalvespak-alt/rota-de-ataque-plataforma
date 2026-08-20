import { createDatabase } from '@plataforma/db'
import { runWorker } from '@plataforma/queue/runtime'
import { logger } from '@plataforma/shared'
import { ThreadsClient } from '@plataforma/threads-api'
import { createThreadsPublisher, spec, type ThreadsPublisherRepository, type NotificationSink } from './index.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const { pool } = createDatabase(databaseUrl)

const repository: ThreadsPublisherRepository = {
  async due(payload) {
    const result = await pool.query<{
      id: string; publication_id: string; user_id: string; payload: { text: string }; status: string; approved_by: string | null; rate_used_24h: number; origin: string
    }>(
      `SELECT variant.id, publication.id publication_id, account.threads_user_id user_id, variant.payload, publication.status, publication.approved_by, account.threads_rate_used_24h rate_used_24h, publication.origin
       FROM scheduled_publications publication
       JOIN content_variants variant ON variant.id = publication.variant_id
       JOIN accounts account ON account.id = publication.account_id AND account.role = 'actor' AND account.status = 'HEALTHY'
       WHERE publication.channel = 'threads' AND publication.status IN ('scheduled', 'approved')
         AND publication.scheduled_for <= now()
         AND publication.scheduled_for >= now() - interval '1 hour'
         AND ($1::uuid IS NULL OR variant.id = $1) AND ($2::uuid IS NULL OR publication.id = $2)
       ORDER BY publication.scheduled_for LIMIT 5`,
      [payload.variantId ?? null, payload.publicationId ?? null],
    )
    return result.rows.map((row) => ({
      id: row.id, publicationId: row.publication_id, userId: row.user_id, text: row.payload.text, status: row.status, approvedBy: row.approved_by ?? undefined, rateUsed24h: row.rate_used_24h,
      origin: (row.origin ?? 'manual') as 'manual' | 'ai_generated' | 'automation',
    }))
  },
  async complete(row, externalId, traceId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`INSERT INTO content_publications(variant_id, channel, external_id, correlation_id) SELECT $1, 'threads', $2, correlation_id FROM scheduled_publications WHERE id = $3 ON CONFLICT DO NOTHING`, [row.id, externalId, row.publicationId])
      await client.query(`UPDATE content_variants SET status = 'published', published_at = now(), external_ref = jsonb_build_object('id', $2) WHERE id = $1`, [row.id, externalId])
      await client.query(`UPDATE scheduled_publications SET status = 'published', published_at = now(), ig_media_id = $2, error = NULL WHERE id = $1`, [row.publicationId, externalId])
      await client.query(`INSERT INTO content_performance(variant_id, channel) VALUES($1, 'threads') ON CONFLICT(variant_id) DO UPDATE SET computed_at = now()`, [row.id])
      await client.query(`INSERT INTO audit_log(actor_id, action, target, after) VALUES('threads-publisher', 'publication.published', $1, $2::jsonb)`, [row.publicationId, JSON.stringify({ externalId, traceId })])
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  },
  async fail(publicationId, error, traceId) {
    await pool.query(`UPDATE scheduled_publications SET status = 'failed', error = $2 WHERE id = $1`, [publicationId, error])
    await pool.query(`INSERT INTO audit_log(actor_id, action, target, after) VALUES('threads-publisher', 'publication.failed', $1, $2::jsonb)`, [publicationId, JSON.stringify({ error, traceId })])
  },
  async scheduleMetricsCollection(publicationId, externalId) {
    const intervals = [24, 72, 168]
    for (const hours of intervals) {
      await pool.query(
        `INSERT INTO review_inbox(item_type, reason, suggested_action, context, status)
         VALUES('metrics_collection', 'Coleta de métricas agendada', $1::jsonb, $2::jsonb, 'pending')`,
        [
          JSON.stringify({ action: 'collect_metrics', publicationId, externalId, channel: 'threads', hoursAfter: hours }),
          JSON.stringify({ scheduledFor: new Date(Date.now() + hours * 3600_000).toISOString() }),
        ],
      )
    }
  },
}

const notifications: NotificationSink = {
  async notify(type, payload) {
    await pool.query(
      `INSERT INTO review_inbox(item_type, reason, suggested_action, context, status)
       VALUES($1, $2, $3::jsonb, '{}'::jsonb, 'pending')`,
      [type, type === 'publication.needs_approval' ? 'Publicação de IA no Threads aguarda aprovação' : 'Rate limit do Threads atingido', JSON.stringify(payload)],
    )
    logger.info({ type, ...payload }, 'Threads notification created')
  },
}

runWorker(spec.queue, createThreadsPublisher(repository, () => {
  if (!process.env.THREADS_ACCESS_TOKEN) throw new Error('THREADS_ACCESS_TOKEN is required when the Threads publisher is enabled')
  return new ThreadsClient(process.env.THREADS_ACCESS_TOKEN)
}, notifications))
