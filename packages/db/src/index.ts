import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import type { HeartbeatStore } from '@plataforma/shared/worker'

export const createDatabase = (connectionString: string) => {
  const pool = new Pool({ connectionString, max: 10, application_name: 'plataforma' })
  return { pool, db: drizzle(pool) }
}

export function createPostgresHeartbeatStore(pool: Pool): HeartbeatStore {
  return {
    async beat(worker, instanceId, snapshot) {
      await pool.query(`INSERT INTO worker_heartbeats(worker,instance_id,last_beat_at,jobs_done_window,jobs_failed_window,backlog_seen,p95_latency_ms,state)
        VALUES($1,$2,now(),$3,$4,$5,$6,$7)
        ON CONFLICT(worker,instance_id) DO UPDATE SET last_beat_at=now(),jobs_done_window=EXCLUDED.jobs_done_window,jobs_failed_window=EXCLUDED.jobs_failed_window,backlog_seen=EXCLUDED.backlog_seen,p95_latency_ms=EXCLUDED.p95_latency_ms,state=EXCLUDED.state`,
      [worker, instanceId, snapshot.jobsDone, snapshot.jobsFailed, snapshot.backlog, snapshot.p95LatencyMs, snapshot.state])
    },
  }
}

export function encryptToken(token: string, key: Buffer) {
  if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must decode to 32 bytes')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')
}

export function decryptToken(value: string, key: Buffer) {
  const payload = Buffer.from(value, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, payload.subarray(0, 12))
  decipher.setAuthTag(payload.subarray(12, 28))
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8')
}

export async function transitionProspect(client: { query: (sql: string, values: unknown[]) => Promise<unknown> }, leadId: string, campaignId: string, from: string, to: string, stage: string) {
  await client.query('BEGIN', [])
  try {
    await client.query('UPDATE prospect_status SET status=$3, stage=$4, updated_at=now() WHERE lead_id=$1 AND campaign_id=$2 AND status=$5', [leadId, campaignId, to, stage, from])
    await client.query('INSERT INTO lead_status_history(lead_id,campaign_id,from_status,to_status) VALUES($1,$2,$3,$4)', [leadId, campaignId, from, to])
    await client.query('COMMIT', [])
  } catch (error) { await client.query('ROLLBACK', []); throw error }
}
