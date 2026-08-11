import { collectVisibleFollowers, launchPersistentContext, withAccountMutex } from '@plataforma/browser'
import { createDatabase, createPostgresHeartbeatStore } from '@plataforma/db'
import { createQueueRegistry, enqueueOnce } from '@plataforma/queue'
import { runWorker } from '@plataforma/queue/runtime'
import { startWorkerHeartbeat } from '@plataforma/shared/worker'
import { Redis } from 'ioredis'
import { Client } from 'minio'
import path from 'node:path'
import { Readable } from 'node:stream'
import { gunzipSync, gzipSync } from 'node:zlib'
import { createFollowerProcessor, spec, type FollowerRepository } from './index.js'

const databaseUrl = process.env.DATABASE_URL
const redisUrl = process.env.REDIS_URL
const s3Endpoint = process.env.S3_ENDPOINT
const s3Access = process.env.S3_ACCESS_KEY
const s3Secret = process.env.S3_SECRET_KEY
const s3Bucket = process.env.S3_BUCKET

if (!databaseUrl || !redisUrl || !s3Endpoint || !s3Access || !s3Secret || !s3Bucket) {
  throw new Error('Follower mining runtime configuration is incomplete')
}

const { pool } = createDatabase(databaseUrl)
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null })
const registry = createQueueRegistry(redisUrl)
const endpoint = new URL(s3Endpoint)
const s3 = new Client({
  endPoint: endpoint.hostname,
  port: Number(endpoint.port || (/https:/.test(endpoint.protocol) ? 443 : 80)),
  useSSL: /https:/.test(endpoint.protocol),
  accessKey: s3Access,
  secretKey: s3Secret,
})

const repository: FollowerRepository = {
  async target(scheduleId) {
    return (await pool.query(
      `SELECT c.id "competitorId", cs.campaign_id "campaignId", c.username
       FROM crawl_schedule cs
       JOIN competitors c ON c.id::text = cs.source_id
       WHERE cs.id = $1 AND cs.source_type = 'follower'
         AND cs.next_run_at <= now() AND c.status = 'active'`,
      [scheduleId],
    )).rows[0] ?? null
  },
  async previous(competitorId) {
    return (await pool.query(
      `SELECT id "snapshotId", storage_ref "storageRef"
       FROM follower_snapshots WHERE competitor_id = $1
       ORDER BY captured_at DESC LIMIT 1`,
      [competitorId],
    )).rows[0] ?? null
  },
  async save(scheduleId, target, storageRef, hash, current, added, removed, traceId) {
    const client = await pool.connect()
    const leadIds: string[] = []
    try {
      await client.query('BEGIN')
      const previous = await client.query<{ id: string }>(
        `SELECT id FROM follower_snapshots WHERE competitor_id = $1 ORDER BY captured_at DESC LIMIT 1`,
        [target.competitorId],
      )
      const snapshot = await client.query<{ id: string }>(
        `INSERT INTO follower_snapshots(competitor_id, followers_hash, followers_count_seen, storage_ref)
         VALUES($1, $2, $3, $4) RETURNING id`,
        [target.competitorId, hash, current.length, storageRef],
      )
      for (const item of [
        ...added.map((profile) => ({ ...profile, kind: 'new_follower' })),
        ...removed.map((profile) => ({ ...profile, kind: 'lost_follower' })),
      ]) {
        await client.query(
          `INSERT INTO follower_deltas(competitor_id, snapshot_from, snapshot_to, username, ig_user_id, delta_kind)
           VALUES($1, $2, $3, $4, $5, $6)`,
          [target.competitorId, previous.rows[0]?.id ?? null, snapshot.rows[0]!.id, item.username, item.igUserId ?? null, item.kind],
        )
      }
      for (const item of added) {
        let lead = await client.query<{ id: string }>(
          'SELECT id FROM leads WHERE lower(username_current) = lower($1) LIMIT 1',
          [item.username],
        )
        if (!lead.rows[0]) {
          lead = await client.query<{ id: string }>(
            'INSERT INTO leads(username_current, instagram_user_id, profile_url) VALUES($1, $2, $3) RETURNING id',
            [item.username, item.igUserId ?? null, `https://instagram.com/${item.username}/`],
          )
        }
        const leadId = lead.rows[0]!.id
        leadIds.push(leadId)
        await client.query(
          `INSERT INTO lead_sources(lead_id, campaign_id, competitor_id, source_kind)
           VALUES($1, $2, $3, 'follower') ON CONFLICT DO NOTHING`,
          [leadId, target.campaignId, target.competitorId],
        )
        await client.query(
          `INSERT INTO lead_interactions(lead_id, kind, direction, source, ref_type, ref_id, payload)
           VALUES($1, 'new_follower_detected', 'inbound', 'scrape', 'follower_snapshot', $2, $3)`,
          [leadId, snapshot.rows[0]!.id, JSON.stringify({ competitorId: target.competitorId, traceId })],
        )
      }
      await client.query(
        `UPDATE crawl_schedule
         SET last_run_at = now(), next_run_at = now() + current_interval_seconds * interval '1 second'
         WHERE id = $1`,
        [scheduleId],
      )
      await client.query('COMMIT')
      return leadIds
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
}

const collector = {
  collect: (target: { username: string }, accountId: string) => withAccountMutex(redis, accountId, async () => {
    const context = await launchPersistentContext(path.join(
      process.env.CHROMIUM_PROFILES_DIR ?? '/data/chromium_profiles',
      accountId,
    ))
    try {
      return (await collectVisibleFollowers(
        await context.newPage(),
        `https://instagram.com/${target.username}/`,
      )).map((profile) => ({ username: profile.username }))
    } finally {
      await context.close()
    }
  }),
}

const store = {
  async put(key: string, data: Buffer) {
    const compressed = gzipSync(data)
    await s3.putObject(s3Bucket, key, compressed, compressed.length, { 'content-type': 'application/gzip' })
    return key
  },
  async get(ref: string) {
    const stream = await s3.getObject(s3Bucket, ref)
    const chunks: Buffer[] = []
    for await (const chunk of stream as Readable) chunks.push(Buffer.from(chunk))
    return JSON.parse(gunzipSync(Buffer.concat(chunks)).toString('utf8'))
  },
}

const queue = {
  scoring: (leadId: string, campaignId: string) => enqueueOnce(
    registry.queues.scoring,
    'scoring',
    [leadId, campaignId, 'new-follower'],
    { leadId, campaignId, trigger: 'new_follower' },
  ).then(() => undefined),
}

const worker = runWorker(spec.queue, createFollowerProcessor(repository, collector, store, queue))
const stop = startWorkerHeartbeat(
  spec.queue,
  createPostgresHeartbeatStore(pool),
  () => ({ jobsDone: 0, jobsFailed: 0, backlog: 0, p95LatencyMs: 0, state: worker?.isRunning() ? 'running' : 'disabled' }),
)
process.once('SIGTERM', () => void stop()
  .finally(() => pool.end())
  .finally(() => redis.quit())
  .finally(() => registry.connection.quit()))
