import { followInstagramProfile, launchPersistentContext, withAccountMutex } from '@plataforma/browser'
import { createDatabase, createPostgresHeartbeatStore } from '@plataforma/db'
import { createQueueRegistry, enqueueOnce } from '@plataforma/queue'
import { runWorker } from '@plataforma/queue/runtime'
import { startWorkerHeartbeat } from '@plataforma/shared/worker'
import { Redis } from 'ioredis'
import path from 'node:path'
import { createEngagementProcessor, spec, type EngagementAction, type EngagementRepository } from './index.js'

const databaseUrl = process.env.DATABASE_URL, redisUrl = process.env.REDIS_URL
if (!databaseUrl || !redisUrl) throw new Error('DATABASE_URL and REDIS_URL are required')
const { pool } = createDatabase(databaseUrl)
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null })
const registry = createQueueRegistry(redisUrl)
const repository: EngagementRepository = {
  async action(id) { return (await pool.query(`SELECT e.id,e.account_id "accountId",e.lead_id "leadId",e.campaign_id "campaignId",e.target_ref_id "targetRefId",l.profile_url "profileUrl",e.action_type "actionType",e.reason_code "reasonCode",e.approved_by "approvedBy",e.status FROM engagement_actions e JOIN leads l ON l.id=e.lead_id WHERE e.id=$1`, [id])).rows[0] ?? null },
  async policy(accountId, actionType) { return (await pool.query(`SELECT p.enabled,p.hourly_limit "hourlyLimit",p.daily_limit "dailyLimit",p.cooldown_seconds "cooldownSeconds",(SELECT COUNT(*)::int FROM engagement_actions e WHERE e.account_id=p.account_id AND e.action_type=p.action_type AND e.completed_at>=date_trunc('hour',now())) "hourCount",(SELECT COUNT(*)::int FROM engagement_actions e WHERE e.account_id=p.account_id AND e.action_type=p.action_type AND e.completed_at>=date_trunc('day',now())) "dayCount",(SELECT MAX(completed_at) FROM engagement_actions e WHERE e.account_id=p.account_id AND e.action_type=p.action_type) "lastActionAt" FROM action_policies p WHERE p.account_id=$1 AND p.action_type=$2`, [accountId, actionType])).rows[0] ?? null },
  async hasTrail(leadId) { return Boolean((await pool.query('SELECT 1 FROM lead_interactions WHERE lead_id=$1 LIMIT 1', [leadId])).rowCount) },
  async running(id) { return Boolean((await pool.query(`UPDATE engagement_actions SET status='running',attempts=attempts+1 WHERE id=$1 AND status='approved' RETURNING id`, [id])).rowCount) },
  async complete(action, changed, traceId) { const client = await pool.connect(); try { await client.query('BEGIN'); await client.query(`UPDATE engagement_actions SET status='done',executed_at=now(),completed_at=now(),reason_code=$2,last_error=NULL WHERE id=$1`, [action.id, changed ? 'SUCCESS' : 'ALREADY_DONE']); await client.query(`INSERT INTO lead_interactions(lead_id,account_id,kind,direction,source,ref_type,ref_id,payload) VALUES($1,$2,'follow_sent','outbound','scrape','engagement_action',$3,$4)`, [action.leadId, action.accountId, action.id, JSON.stringify({ changed, reason_code: action.reasonCode, trace_id: traceId })]); await client.query(`INSERT INTO events(account_id,campaign_id,scope,level,payload) VALUES($1,$2,'engagement','info',$3)`, [action.accountId, action.campaignId, JSON.stringify({ type: 'engagement.follow.completed', actionId: action.id, leadId: action.leadId, changed, traceId })]); await client.query('UPDATE accounts SET last_action_at=now() WHERE id=$1', [action.accountId]); await client.query('COMMIT') } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() } },
  async fail(id, error, traceId) { const value = error instanceof Error ? error.message : String(error); const reason = (error as { reasonCode?: string })?.reasonCode ?? 'UNKNOWN'; await pool.query(`UPDATE engagement_actions SET status='failed',last_error=$2,reason_code=$3 WHERE id=$1`, [id, value, reason]); await pool.query(`INSERT INTO events(scope,level,payload) VALUES('engagement','error',$1)`, [JSON.stringify({ type: 'engagement.follow.failed', actionId: id, error: value, reason, traceId })]) },
}
const executor = { async follow(action: EngagementAction) { return withAccountMutex(redis, action.accountId, async () => { const context = await launchPersistentContext(path.join(process.env.CHROMIUM_PROFILES_DIR ?? '/data/chromium_profiles', action.accountId)); try { return await followInstagramProfile(await context.newPage(), action.profileUrl) } finally { await context.close() } }) } }
const queue = { retention: (actionId: string, checkpointDays: number, delayMs: number) => enqueueOnce(registry.queues['retention-tracker'], 'retention-tracker', ['action', actionId, 'day', checkpointDays], { actionId, checkpointDays, accountRole: 'actor' }, { delay: delayMs }).then(() => undefined) }
const worker = runWorker(spec.queue, createEngagementProcessor(repository, executor, queue))
const stopHeartbeat = startWorkerHeartbeat(spec.queue, createPostgresHeartbeatStore(pool), () => ({ jobsDone: 0, jobsFailed: 0, backlog: 0, p95LatencyMs: 0, state: worker?.isRunning() ? 'running' : 'disabled' }))
process.once('SIGTERM', () => void stopHeartbeat().finally(() => pool.end()).finally(() => redis.quit()).finally(() => registry.connection.quit()))
