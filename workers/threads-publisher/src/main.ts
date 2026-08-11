import { createDatabase } from '@plataforma/db'
import { runWorker } from '@plataforma/queue/runtime'
import { ThreadsClient } from '@plataforma/threads-api'
import { createThreadsPublisher, spec, type PublishableThreadsVariant, type ThreadsPublisherRepository } from './index.js'
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const { pool } = createDatabase(databaseUrl)
const repository: ThreadsPublisherRepository = { async get(id) { const result = await pool.query<{ id: string; user_id: string; payload: { text: string }; status: string; rate_used_24h: number }>(`SELECT variant.id, account.threads_user_id user_id, variant.payload, variant.status, account.threads_rate_used_24h rate_used_24h FROM content_variants variant JOIN content_items item ON item.id=variant.content_item_id JOIN accounts account ON account.role='actor' WHERE variant.id=$1 AND variant.channel='threads'`, [id]); const row = result.rows[0]; return row ? { id: row.id, userId: row.user_id, text: row.payload.text, status: row.status, rateUsed24h: row.rate_used_24h } : null }, async complete(variantId, externalId) { const client = await pool.connect(); try { await client.query('BEGIN'); await client.query(`INSERT INTO content_publications(variant_id,channel,external_id) VALUES($1,'threads',$2)`, [variantId, externalId]); await client.query(`UPDATE content_variants SET status='published',published_at=now(),external_ref=jsonb_build_object('id',$2) WHERE id=$1`, [variantId, externalId]); await client.query(`INSERT INTO content_performance(variant_id,channel) VALUES($1,'threads') ON CONFLICT(variant_id) DO UPDATE SET computed_at=now()`, [variantId]); await client.query('COMMIT') } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() } } }
runWorker(spec.queue, createThreadsPublisher(repository, () => {
  if (!process.env.THREADS_ACCESS_TOKEN) throw new Error('THREADS_ACCESS_TOKEN is required when the Threads publisher is enabled')
  return new ThreadsClient(process.env.THREADS_ACCESS_TOKEN)
}))
