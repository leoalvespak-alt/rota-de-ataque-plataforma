import { createDatabase } from '@plataforma/db'
import { runWorker } from '@plataforma/queue/runtime'
import { createDataQualityProcessor, spec, type DataQualityRepository } from './index.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const { pool } = createDatabase(databaseUrl)
interface RepairResult extends Record<string, number> { mergedLeads: number; repairedOrphans: number; refreshedViews: number; statusRepairs: number }

const repository: DataQualityRepository = {
  async repair(payload, traceId) {
    const client = await pool.connect()
    const result: RepairResult = { mergedLeads: 0, repairedOrphans: 0, refreshedViews: 0, statusRepairs: 0 }
    try {
      await client.query('BEGIN')
      const duplicates = await client.query<{ canonical_id: string; duplicate_id: string }>(
        `WITH ranked AS (
           SELECT id, first_seen_at, lower(username_current) username,
                  first_value(id) OVER (PARTITION BY lower(username_current) ORDER BY first_seen_at, id) canonical_id,
                  row_number() OVER (PARTITION BY lower(username_current) ORDER BY first_seen_at, id) position
           FROM leads WHERE username_current <> ''
         ) SELECT canonical_id, id duplicate_id FROM ranked WHERE position > 1`,
      )
      for (const duplicate of duplicates.rows) {
        const hasActions = (await client.query<{ exists: boolean }>(
          `SELECT EXISTS(SELECT 1 FROM engagement_actions WHERE lead_id = $1) exists`,
          [duplicate.duplicate_id],
        )).rows[0]?.exists
        if (hasActions) continue
        await client.query(`UPDATE lead_username_history SET lead_id = $1 WHERE lead_id = $2`, [duplicate.canonical_id, duplicate.duplicate_id])
        await client.query(`UPDATE lead_score_history SET lead_id = $1 WHERE lead_id = $2`, [duplicate.canonical_id, duplicate.duplicate_id])
        await client.query(`UPDATE lead_status_history SET lead_id = $1 WHERE lead_id = $2`, [duplicate.canonical_id, duplicate.duplicate_id])
        await client.query(`UPDATE lead_interactions SET lead_id = $1 WHERE lead_id = $2`, [duplicate.canonical_id, duplicate.duplicate_id])
        await client.query(`UPDATE dm_drafts SET lead_id = $1 WHERE lead_id = $2`, [duplicate.canonical_id, duplicate.duplicate_id])
        await client.query(`UPDATE nba_recommendations SET lead_id = $1 WHERE lead_id = $2`, [duplicate.canonical_id, duplicate.duplicate_id])
        await client.query(`UPDATE conversion_events SET lead_id = $1 WHERE lead_id = $2`, [duplicate.canonical_id, duplicate.duplicate_id])
        await client.query(`UPDATE reciprocity_events SET lead_id = $1 WHERE lead_id = $2`, [duplicate.canonical_id, duplicate.duplicate_id])
        await client.query(`UPDATE community_edges SET from_lead_id = $1 WHERE from_lead_id = $2`, [duplicate.canonical_id, duplicate.duplicate_id])
        await client.query(`DELETE FROM lead_community_membership old WHERE old.lead_id = $1 AND EXISTS (SELECT 1 FROM lead_community_membership current WHERE current.lead_id = $2 AND current.community_id = old.community_id)`, [duplicate.duplicate_id, duplicate.canonical_id])
        await client.query(`UPDATE lead_community_membership SET lead_id = $1 WHERE lead_id = $2`, [duplicate.canonical_id, duplicate.duplicate_id])
        await client.query(`DELETE FROM lead_sources old WHERE old.lead_id = $1 AND EXISTS (SELECT 1 FROM lead_sources current WHERE current.lead_id = $2 AND current.comment_id IS NOT DISTINCT FROM old.comment_id)`, [duplicate.duplicate_id, duplicate.canonical_id])
        await client.query(`UPDATE lead_sources SET lead_id = $1 WHERE lead_id = $2`, [duplicate.canonical_id, duplicate.duplicate_id])
        await client.query(`DELETE FROM lead_scores old WHERE old.lead_id = $1 AND EXISTS (SELECT 1 FROM lead_scores current WHERE current.lead_id = $2 AND current.campaign_id = old.campaign_id)`, [duplicate.duplicate_id, duplicate.canonical_id])
        await client.query(`UPDATE lead_scores SET lead_id = $1 WHERE lead_id = $2`, [duplicate.canonical_id, duplicate.duplicate_id])
        await client.query(`DELETE FROM prospect_status old WHERE old.lead_id = $1 AND EXISTS (SELECT 1 FROM prospect_status current WHERE current.lead_id = $2 AND current.campaign_id = old.campaign_id)`, [duplicate.duplicate_id, duplicate.canonical_id])
        await client.query(`UPDATE prospect_status SET lead_id = $1 WHERE lead_id = $2`, [duplicate.canonical_id, duplicate.duplicate_id])
        await client.query(`DELETE FROM lead_profile WHERE lead_id = $1 AND EXISTS (SELECT 1 FROM lead_profile WHERE lead_id = $2)`, [duplicate.duplicate_id, duplicate.canonical_id])
        await client.query(`UPDATE lead_profile SET lead_id = $1 WHERE lead_id = $2`, [duplicate.canonical_id, duplicate.duplicate_id])
        await client.query(`DELETE FROM leads WHERE id = $1`, [duplicate.duplicate_id])
        result.mergedLeads++
      }
      const orphanInteractions = await client.query(`DELETE FROM lead_interactions WHERE lead_id IS NULL AND at < now() - interval '30 days'`)
      result.repairedOrphans += orphanInteractions.rowCount ?? 0
      const statuses = await client.query(
        `UPDATE prospect_status status SET stage = 'engaged', updated_at = now()
         WHERE EXISTS (
           SELECT 1 FROM engagement_actions action
           WHERE action.lead_id = status.lead_id AND action.campaign_id = status.campaign_id AND action.status = 'done'
         ) AND status.stage = 'discovery'`,
      )
      result.statusRepairs = statuses.rowCount ?? 0
      if (payload.refreshViews !== false) {
        await client.query('REFRESH MATERIALIZED VIEW mv_topic_trends')
        await client.query('REFRESH MATERIALIZED VIEW mv_audience_overlap')
        await client.query('REFRESH MATERIALIZED VIEW mv_engagement_effectiveness')
        await client.query('REFRESH MATERIALIZED VIEW mv_competitor_performance')
        await client.query('REFRESH MATERIALIZED VIEW mv_lead_rankings')
        await client.query('REFRESH MATERIALIZED VIEW mv_daily_acquisition')
        await client.query('REFRESH MATERIALIZED VIEW mv_campaign_performance')
        await client.query('REFRESH MATERIALIZED VIEW mv_conversation_funnel')
        await client.query('REFRESH MATERIALIZED VIEW mv_content_performance')
        result.refreshedViews = 9
      }
      await client.query(`INSERT INTO audit_log(actor_id, action, target, after) VALUES('data-quality', 'repair', 'platform', $1::jsonb)`, [JSON.stringify({ ...result, traceId, campaignId: payload.campaignId ?? null })])
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
}

runWorker(spec.queue, createDataQualityProcessor(repository))
