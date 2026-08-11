import { createDatabase } from '@plataforma/db'
import { MetaApiClient } from '@plataforma/meta-api'
import { runWorker } from '@plataforma/queue/runtime'
import { Client } from 'minio'
import { Readable } from 'node:stream'
import { createPublisherProcessor, spec, type PublisherRepository } from './index.js'
import { recordPublishedInstagram } from './instagram-publication.js'

const databaseUrl = process.env.DATABASE_URL
const token = process.env.META_ACCESS_TOKEN
const endpoint = process.env.S3_ENDPOINT
const accessKey = process.env.S3_ACCESS_KEY
const secretKey = process.env.S3_SECRET_KEY
const bucket = process.env.S3_PUBLIC_BUCKET ?? process.env.S3_BUCKET
const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL
if (!databaseUrl || !token || !endpoint || !accessKey || !secretKey || !bucket || !publicBaseUrl) throw new Error('Publisher runtime configuration is incomplete')
const { pool } = createDatabase(databaseUrl)
const parsedEndpoint = new URL(endpoint)
const s3 = new Client({ endPoint: parsedEndpoint.hostname, port: Number(parsedEndpoint.port || (parsedEndpoint.protocol === 'https:' ? 443 : 80)), useSSL: parsedEndpoint.protocol === 'https:', accessKey, secretKey })
const meta = new MetaApiClient(token, process.env.META_API_VERSION ?? 'v21.0')

const readObject = async (key: string) => {
  const stream = await s3.getObject(bucket, key)
  const chunks: Buffer[] = []
  for await (const chunk of stream as Readable) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

const repository: PublisherRepository = {
  async due(payload) {
    const result = await pool.query<{
      id: string; variant_id: string | null; account_id: string; role: 'collector' | 'actor'; status: string; approved_by: string | null; meta_ig_user_id: string; caption: string; media_asset_ref: string
    }>(
      `SELECT publication.id, publication.variant_id, account.id account_id, account.role, publication.status, publication.approved_by,
              account.meta_ig_user_id, publication.caption, publication.media_asset_ref
       FROM scheduled_publications publication
       JOIN content_opportunities opportunity ON opportunity.id = publication.content_opportunity_id
       JOIN accounts account ON account.id = publication.account_id
         AND account.role = 'actor' AND account.status = 'HEALTHY'
       WHERE publication.status IN ('scheduled', 'approved')
         AND publication.scheduled_for <= now()
         AND ($1::uuid IS NULL OR publication.id = $1)
         AND ($2::uuid IS NULL OR account.id = $2)
       ORDER BY publication.scheduled_for LIMIT 5`,
      [payload.publicationId ?? null, payload.accountId ?? null],
    )
    return Promise.all(result.rows.map(async (row) => ({
      id: row.id, variantId: row.variant_id ?? undefined, accountId: row.account_id, role: row.role, status: row.status === 'approved' ? 'approved' : 'awaiting_approval', approvedBy: row.approved_by ?? undefined,
      igUserId: row.meta_ig_user_id, caption: row.caption ?? '', key: `published/${row.id}.png`, png: await readObject(row.media_asset_ref),
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
}

const store = {
  async uploadPng(key: string, png: Uint8Array) {
    await s3.putObject(bucket, key, Buffer.from(png), png.byteLength, { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable' })
    return { storageRef: key, publicUrl: `${publicBaseUrl.replace(/\/$/, '')}/${encodeURIComponent(key).replace(/%2F/g, '/')}` }
  },
}

runWorker(spec.queue, createPublisherProcessor(repository, store, meta))
