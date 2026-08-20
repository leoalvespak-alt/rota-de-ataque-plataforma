import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import type { HeartbeatStore } from '@plataforma/shared/worker'

const _pools = new Map<string, { pool: Pool; db: ReturnType<typeof drizzle> }>()

export const createDatabase = (connectionString: string) => {
  let entry = _pools.get(connectionString)
  if (!entry) {
    const pool = new Pool({ connectionString, max: 10, application_name: 'plataforma' })
    entry = { pool, db: drizzle(pool) }
    _pools.set(connectionString, entry)
  }
  return entry
}

export function createPostgresHeartbeatStore(pool: Pool): HeartbeatStore {
  return {
    async beat(worker, instanceId, snapshot) {
      await pool.query(`INSERT INTO worker_heartbeats(worker,instance_id,last_beat_at,jobs_done_window,jobs_failed_window,backlog_seen,p95_latency_ms,state)
        VALUES($1,$2,now(),$3,$4,$5,$6,$7)
        ON CONFLICT(worker,instance_id) DO UPDATE SET last_beat_at=now(),jobs_done_window=EXCLUDED.jobs_done_window,jobs_failed_window=EXCLUDED.jobs_failed_window,backlog_seen=EXCLUDED.backlog_seen,p95_latency_ms=EXCLUDED.p95_latency_ms,state=EXCLUDED.state`,
      [worker, instanceId, snapshot.jobsDone, snapshot.jobsFailed, snapshot.backlog, snapshot.p95LatencyMs, snapshot.state])
      // Purge stale instances of the same worker that haven't beaten in 10 minutes
      await pool.query(
        `DELETE FROM worker_heartbeats WHERE worker=$1 AND instance_id<>$2 AND last_beat_at < now() - interval '10 minutes'`,
        [worker, instanceId],
      )
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

export type LlmProviderKind = 'openai-compatible' | 'anthropic' | 'local'
export interface LlmRuntimeConfig { provider: 'openai-compatible' | 'anthropic'; endpoint?: string; model: string; apiKey?: string; maxOutputTokens: number; temperature: number; source: 'database' | 'environment' }

function environmentLlmConfig(env: NodeJS.ProcessEnv): LlmRuntimeConfig {
  const provider = env.LLM_PROVIDER === 'anthropic' ? 'anthropic' : 'openai-compatible'
  const model = env.LLM_MODEL?.trim()
  const endpoint = env.LLM_ENDPOINT?.trim()
  if (!model || (provider === 'openai-compatible' && !endpoint)) throw new Error('Nenhum modelo de IA ativo foi configurado')
  return { provider, endpoint, model, apiKey: env.LLM_API_KEY?.trim() || undefined, maxOutputTokens: 512, temperature: 0, source: 'environment' }
}

export async function loadLlmRuntimeConfig(pool: Pool, env: NodeJS.ProcessEnv = process.env): Promise<LlmRuntimeConfig> {
  try {
    const result = await pool.query<{kind:LlmProviderKind;base_url:string;secret_env_name:string|null;model_id:string;max_output_tokens:number;temperature:string}>(`SELECT provider.kind,provider.base_url,provider.secret_env_name,model.model_id,model.max_output_tokens,model.temperature
      FROM ai_models model JOIN ai_providers provider ON provider.id=model.provider_id
      WHERE model.enabled AND provider.enabled AND provider.deleted_at IS NULL
      ORDER BY model.is_default DESC, model.priority ASC`)
    const selected = result.rows.find(row => row.kind === 'local' || Boolean(row.secret_env_name && env[row.secret_env_name]))
    if (!selected) return environmentLlmConfig(env)
    const apiKey = selected.secret_env_name ? env[selected.secret_env_name]?.trim() || undefined : undefined
    return { provider: selected.kind === 'anthropic' ? 'anthropic' : 'openai-compatible', endpoint: selected.base_url, model: selected.model_id, apiKey, maxOutputTokens: selected.max_output_tokens, temperature: Number(selected.temperature), source: 'database' }
  } catch (error) {
    if ((error as {code?:string}).code === '42P01') return environmentLlmConfig(env)
    throw error
  }
}

export async function transitionProspect(client: { query: (sql: string, values: unknown[]) => Promise<unknown> }, leadId: string, campaignId: string, from: string, to: string, stage: string) {
  await client.query('BEGIN', [])
  try {
    await client.query('UPDATE prospect_status SET status=$3, stage=$4, updated_at=now() WHERE lead_id=$1 AND campaign_id=$2 AND status=$5', [leadId, campaignId, to, stage, from])
    await client.query('INSERT INTO lead_status_history(lead_id,campaign_id,from_status,to_status) VALUES($1,$2,$3,$4)', [leadId, campaignId, from, to])
    await client.query('COMMIT', [])
  } catch (error) { await client.query('ROLLBACK', []); throw error }
}
