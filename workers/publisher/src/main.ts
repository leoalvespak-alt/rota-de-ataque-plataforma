import { createDatabase } from '@plataforma/db'
import { MetaApiClient } from '@plataforma/meta-api'
import { runWorker } from '@plataforma/queue/runtime'
import { logger } from '@plataforma/shared'
import { Client } from 'minio'
import { Readable } from 'node:stream'
import { createPublisherProcessor, spec, type PublisherRepository, type NotificationSink } from './index.js'
import { recordPublishedInstagram } from './instagram-publication.js'

const databaseUrl = process.env.DATABASE_URL
const token = process.env.META_ACCESS_TOKEN
const endpoint = process.env.S3_ENDPOINT
const accessKey = process.env.S3_ACCESS_KEY
const secretKey = process.env.S3_SECRET_KEY
const bucket = process.env.S3_PUBLIC_BUCKET ?? process.env.S3_BUCKET
const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL
if (!databaseUrl || !endpoint || !accessKey || !secretKey || !bucket || !publicBaseUrl) throw new Error('Publisher runtime configuration is incomplete')
const { pool } = createDatabase(databaseUrl)
const parsedEndpoint = new URL(endpoint)
const s3 = new Client({ endPoint: parsedEndpoint.hostname, port: Number(parsedEndpoint.port || (parsedEndpoint.protocol === 'https:' ? 443 : 80)), useSSL: parsedEndpoint.protocol === 'https:', accessKey, secretKey })

const meta = token ? new MetaApiClient(token, process.env.META_API_VERSION ?? 'v26.0') : null
if (!meta) logger.warn('META_ACCESS_TOKEN not set — Instagram will use fallback package mode')

const readObject = async (key: string) => {
  const stream = await s3.getObject(bucket, key)
  const chunks: Buffer[] = []
  for await (const chunk of stream as Readable) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

const repository: PublisherRepository = {
  async due(payload) {
    const result = await pool.query<{
      id: string; variant_id: string | null; account_id: string; role: 'collector' | 'actor'; status: string; approved_by: string | null; meta_ig_user_id: string; caption: string; media_asset_ref: string; origin: string; channel: string; hashtags: string | null; cta: string | null
    }>(
      `SELECT publication.id, publication.variant_id, account.id account_id, account.role, publication.status, publication.approved_by,
              account.meta_ig_user_id, publication.caption, publication.media_asset_ref, publication.origin, publication.channel,
              publication.hashtags, publication.cta
       FROM scheduled_publications publication
       JOIN content_opportunities opportunity ON opportunity.id = publication.content_opportunity_id
       JOIN accounts account ON account.id = publication.account_id
         AND account.role = 'actor' AND account.status = 'HEALTHY'
       WHERE publication.status IN ('scheduled', 'approved')
         AND publication.channel = 'instagram'
         AND publication.scheduled_for <= now()
         AND publication.scheduled_for >= now() - interval '1 hour'
         AND ($1::uuid IS NULL OR publication.id = $1)
         AND ($2::uuid IS NULL OR account.id = $2)
       ORDER BY publication.scheduled_for LIMIT 5`,
      [payload.publicationId ?? null, payload.accountId ?? null],
    )
    return Promise.all(result.rows.map(async (row) => ({
      id: row.id, variantId: row.variant_id ?? undefined, accountId: row.account_id, role: row.role, status: row.status === 'approved' ? 'approved' : 'awaiting_approval', approvedBy: row.approved_by ?? undefined,
      igUserId: row.meta_ig_user_id, caption: row.caption ?? '', key: `published/${row.id}.png`, png: await readObject(row.media_asset_ref),
      origin: (row.origin ?? 'manual') as 'manual' | 'ai_generated' | 'automation',
      channel: row.channel,
      hashtags: row.hashtags ?? undefined,
      cta: row.cta ?? undefined,
    })))
  },
  async complete(id, variantId, igMediaId, storageRef, traceId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`UPDATE scheduled_publications SET status = 'published', ig_media_id = $2, media_asset_ref = $3, error = NULL, published_at = now() WHERE id = $1`, [id, igMediaId, storageRef])
      if (variantId) await recordPublishedInstagram(client, variantId, igMediaId)
      await client.query(`INSERT INTO audit_log(actor_id, action, target, after) VALUES('publisher', 'publication.published', $1, $2::jsonb)`, [id, JSON.stringify({ variantId, igMediaId, storageRef, traceId })])
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  },
  async fail(id, error, traceId) {
    await pool.query(`UPDATE scheduled_publications SET status = 'failed', error = $2 WHERE id = $1`, [id, error])
    await pool.query(`INSERT INTO audit_log(actor_id, action, target, after) VALUES('publisher', 'publication.failed', $1, $2::jsonb)`, [id, JSON.stringify({ error, traceId })])
  },
  async markAwaitingManualPublish(id, fallback, traceId) {
    await pool.query(`UPDATE scheduled_publications SET status = 'awaiting_manual_publish', error = NULL WHERE id = $1`, [id])
    await pool.query(`INSERT INTO audit_log(actor_id, action, target, after) VALUES('publisher', 'publication.fallback_created', $1, $2::jsonb)`, [id, JSON.stringify({ ...fallback, traceId })])
  },
  async scheduleMetricsCollection(id, externalId) {
    const intervals = [24, 72, 168]
    for (const hours of intervals) {
      await pool.query(
        `INSERT INTO review_inbox(item_type, reason, suggested_action, context, status)
         VALUES('metrics_collection', 'Coleta de métricas agendada', $1::jsonb, $2::jsonb, 'pending')`,
        [
          JSON.stringify({ action: 'collect_metrics', publicationId: id, externalId, hoursAfter: hours }),
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
      [type, type === 'publication.needs_approval' ? 'Publicação de IA aguarda aprovação humana' : 'Publicação requer postagem manual no Instagram', JSON.stringify(payload)],
    )
    logger.info({ type, ...payload }, 'Publication notification created')
  },
}

const store = {
  async uploadPng(key: string, png: Uint8Array) {
    await s3.putObject(bucket, key, Buffer.from(png), png.byteLength, { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable' })
    return { storageRef: key, publicUrl: `${publicBaseUrl.replace(/\/$/, '')}/${encodeURIComponent(key).replace(/%2F/g, '/')}` }
  },
}

runWorker(spec.queue, createPublisherProcessor(repository, store, meta, notifications))
