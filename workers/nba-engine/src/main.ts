import { createDatabase } from '@plataforma/db'
import { runWorker } from '@plataforma/queue/runtime'
import { createNbaProcessor, spec, type NbaRepository } from './index.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const { pool } = createDatabase(databaseUrl)

const repository: NbaRepository = {
  async context(payload) {
    const [rules, config, policies, inbound] = await Promise.all([
      pool.query<{ id: string; name: string; condition_expr: string; action_expr: string; priority: number }>(
        'SELECT id, name, condition_expr, action_expr, priority FROM nba_rules WHERE active = true ORDER BY priority DESC',
      ),
      pool.query<{ p0_threshold: number }>('SELECT p0_threshold FROM campaign_scoring_config WHERE campaign_id = $1', [payload.campaignId]),
      pool.query<{ action_type: string }>(
        `SELECT DISTINCT action_type FROM action_policies
         WHERE enabled = true AND required_role = 'actor'`,
      ),
      pool.query<{ exists: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM own_dm_messages message
           JOIN own_dm_threads thread ON thread.id = message.thread_id
           JOIN leads lead ON lead.instagram_user_id = thread.participant_ig_user_id
                         OR lower(lead.username_current) = lower(thread.participant_username)
           WHERE lead.id = $1 AND message.direction = 'inbound'
         ) exists`,
        [payload.leadId],
      ),
    ])
    return {
      rules: rules.rows.map((rule) => ({ id: rule.id, name: rule.name, conditionExpr: rule.condition_expr, actionExpr: rule.action_expr, priority: rule.priority })),
      threshold: Math.max(0, Math.min(1, Number(config.rows[0]?.p0_threshold ?? 80) / 100)),
      allowedActions: policies.rows.map((policy) => policy.action_type),
      hasInboundDm: Boolean(inbound.rows[0]?.exists),
    }
  },

  async persist(payload, decision, traceId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const recommendation = await client.query<{ id: string }>(
        `INSERT INTO nba_recommendations(lead_id, campaign_id, suggested_action, target_ref, rationale, confidence, status)
         VALUES($1, $2, $3, $4::jsonb, $5, $6, $7) RETURNING id`,
        [payload.leadId, payload.campaignId, decision.action, JSON.stringify(payload.targetRef ?? {}), decision.rationale, decision.confidence, decision.enqueue ? 'queued_for_approval' : 'pending_review'],
      )
      if (decision.enqueue) {
        await client.query(
          `INSERT INTO engagement_actions(
             account_id, lead_id, campaign_id, action_type, target_ref_type, target_ref_id,
             status, priority, reason_code, execution_mode, suggested_by
           ) VALUES($1, $2, $3, $4, 'nba_recommendation', $5, 'awaiting_approval', 'P1', 'SUCCESS', 'api', 'nba-engine')
           ON CONFLICT(account_id, lead_id, action_type, target_ref_id) DO NOTHING`,
          [payload.accountId ?? null, payload.leadId, payload.campaignId, decision.action, recommendation.rows[0]!.id],
        )
      }
      await client.query(
        `INSERT INTO review_inbox(item_type, item_ref_id, reason, suggested_action, context)
         VALUES('nba_recommendation', $1, $2, $3::jsonb, $4::jsonb)`,
        [
          recommendation.rows[0]!.id,
          decision.requiresReview ? 'Human approval required before outbound action' : 'Recommendation review',
          JSON.stringify({ action: decision.action, confidence: decision.confidence }),
          JSON.stringify({ traceId, eventType: payload.eventType, rationale: decision.rationale }),
        ],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
}

runWorker(spec.queue, createNbaProcessor(repository))
