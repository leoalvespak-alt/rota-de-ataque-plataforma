import { createDatabase } from '@plataforma/db'
import { createQueueRegistry, enqueueOnce } from '@plataforma/queue'
import { runWorker } from '@plataforma/queue/runtime'
import { createContentItemOrchestrator, spec, type ContentItemRepository, type VariantEnqueuer } from './index.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const { pool } = createDatabase(databaseUrl)
const registry = createQueueRegistry(process.env.REDIS_URL ?? 'redis://localhost:6379')
const repository: ContentItemRepository = { async get(id) { const result = await pool.query<{ id: string; frozen_at: Date | null; parent_id: string | null; brand_voice_version: string; campaign_active: boolean; actor_healthy: boolean }>(`SELECT item.id, item.frozen_at, item.parent_id, item.brand_voice_version, campaign.status = 'active' campaign_active, EXISTS(SELECT 1 FROM accounts WHERE role='actor' AND status='HEALTHY') actor_healthy FROM content_items item JOIN campaigns campaign ON campaign.id=item.campaign_id WHERE item.id=$1`, [id]); const row = result.rows[0]; return row ? { id: row.id, frozenAt: row.frozen_at, parentId: row.parent_id, brandVoiceVersion: row.brand_voice_version, campaignActive: row.campaign_active, actorHealthy: row.actor_healthy } : null } }
const enqueuer: VariantEnqueuer = { async enqueue(queue, jobId, payload) { await enqueueOnce(registry.queues[queue], queue, [jobId], payload) } }
runWorker(spec.queue, createContentItemOrchestrator(repository, enqueuer))
