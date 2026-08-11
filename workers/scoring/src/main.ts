import { createDatabase, createPostgresHeartbeatStore } from '@plataforma/db'
import { runWorker } from '@plataforma/queue/runtime'
import type { Priority, ScoreInput, ScoreWeights } from '@plataforma/shared'
import { startWorkerHeartbeat } from '@plataforma/shared/worker'
import { createScoringProcessor, spec, type ScoringRepository } from './index.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const { pool } = createDatabase(databaseUrl)

const repository: ScoringRepository = {
  async load(leadId, campaignId) {
    const [signals, config, previous] = await Promise.all([
      pool.query<Record<string, string>>(`SELECT
        count(DISTINCT ls.comment_id)::text comments,
        count(DISTINCT ls.post_id)::text posts,
        count(DISTINCT ls.competitor_id)::text competitors,
        COALESCE(1/(1+EXTRACT(epoch FROM now()-max(ls.discovered_at))/86400),0)::text recency,
        COALESCE(avg(CASE WHEN cc.purchase_signal THEN cc.confidence ELSE cc.confidence*.35 END),0)::text intent,
        COALESCE(avg(cc.confidence),0)::text semantic,
        LEAST(1,count(DISTINCT li.id)/10.0)::text relationship,
        COALESCE(max(current.audience_overlap_score),0)::text overlap,
        COALESCE(EXTRACT(epoch FROM now()-max(ls.discovered_at))/86400,365)::text freshness_days
        FROM lead_sources ls
        LEFT JOIN comment_classification cc ON cc.comment_id=ls.comment_id AND cc.scope='competitor'
        LEFT JOIN lead_interactions li ON li.lead_id=ls.lead_id
        LEFT JOIN lead_scores current ON current.lead_id=ls.lead_id AND current.campaign_id=ls.campaign_id
        WHERE ls.lead_id=$1 AND ls.campaign_id=$2`, [leadId, campaignId]),
      pool.query<Record<string, string>>(`SELECT w_comments,w_posts,w_competitors,w_recency,w_intent,w_semantic,w_relationship,lambda_freshness,w_overlap_commented,p0_threshold,p1_threshold,p2_threshold FROM campaign_scoring_config WHERE campaign_id=$1`, [campaignId]),
      pool.query<{ priority: Priority }>('SELECT priority FROM lead_scores WHERE lead_id=$1 AND campaign_id=$2', [leadId, campaignId]),
    ])
    const signal = signals.rows[0]!
    const weight = config.rows[0]
    if (!weight) throw new Error(`Scoring config missing for campaign ${campaignId}`)
    const input: ScoreInput = { comments: Number(signal.comments), posts: Number(signal.posts), competitors: Number(signal.competitors), recency: Number(signal.recency), intent: Number(signal.intent), semantic: Number(signal.semantic), relationship: Number(signal.relationship), overlap: Number(signal.overlap), freshnessDays: Number(signal.freshness_days) }
    const weights: ScoreWeights = { comments: Number(weight.w_comments), posts: Number(weight.w_posts), competitors: Number(weight.w_competitors), recency: Number(weight.w_recency), intent: Number(weight.w_intent), semantic: Number(weight.w_semantic), relationship: Number(weight.w_relationship), overlap: Number(weight.w_overlap_commented), lambdaFreshness: Number(weight.lambda_freshness), p0: Number(weight.p0_threshold), p1: Number(weight.p1_threshold), p2: Number(weight.p2_threshold) }
    return { input, weights, previousPriority: previous.rows[0]?.priority }
  },
  async save(leadId, campaignId, result, previousPriority) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`INSERT INTO lead_scores(lead_id,campaign_id,base_score,intent_score,relationship_score,freshness_multiplier,final_score,priority,computed_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()) ON CONFLICT(lead_id,campaign_id) DO UPDATE SET base_score=EXCLUDED.base_score,intent_score=EXCLUDED.intent_score,relationship_score=EXCLUDED.relationship_score,freshness_multiplier=EXCLUDED.freshness_multiplier,final_score=EXCLUDED.final_score,priority=EXCLUDED.priority,computed_at=now()`, [leadId, campaignId, result.baseScore, result.intentScore, result.relationshipScore, result.freshnessMultiplier, result.finalScore, result.priority])
      await client.query(`INSERT INTO lead_score_history(lead_id,campaign_id,base_score,intent_score,relationship_score,final_score) VALUES($1,$2,$3,$4,$5,$6)`, [leadId, campaignId, result.baseScore, result.intentScore, result.relationshipScore, result.finalScore])
      if (previousPriority !== result.priority) await client.query(`INSERT INTO events(campaign_id,scope,level,payload) VALUES($1,'lead','info',$2)`, [campaignId, JSON.stringify({ type: 'lead.priority.changed', leadId, from: previousPriority ?? null, to: result.priority, finalScore: result.finalScore })])
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  },
}
const worker = runWorker(spec.queue, createScoringProcessor(repository))
const stopHeartbeat = startWorkerHeartbeat(spec.queue, createPostgresHeartbeatStore(pool), () => ({ jobsDone: 0, jobsFailed: 0, backlog: 0, p95LatencyMs: 0, state: worker?.isRunning() ? 'running' : 'disabled' }))
process.once('SIGTERM', () => void stopHeartbeat().finally(() => pool.end()))
